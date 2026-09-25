import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import type { VerificationTokenType } from '../generated/prisma/enums.js';
import { DEFAULT_CATEGORIES } from '../modules/categories/default-categories.js';
import { MailService } from '../modules/mail/mail.service.js';
import { EMAIL_VERIFICATION_TTL_MS, PASSWORD_RESET_TTL_MS } from './auth.constants.js';
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth-requests.dto.js';
import type { AuthPayloadDto, SessionDto, UserDto } from './dto/auth-responses.dto.js';
import { PasswordService } from './password/password.service.js';
import type { ClientContext } from './security/client-context.js';
import {
  CLEARED_LOCKOUT,
  isLocked,
  lockMinutesRemaining,
  registerFailure,
} from './security/lockout.policy.js';
import { SecurityEventsService } from './security/security-events.service.js';
import { SessionService } from './sessions/session.service.js';
import { AccessTokenService } from './tokens/access-token.service.js';
import { generateSecret, isUuid, sha256 } from './tokens/token.util.js';
import { toUserDto } from '../modules/users/user.mapper.js';

/** Resultado de login/refresh: corpo da resposta + dados para os cookies. */
export interface AuthResult {
  payload: AuthPayloadDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const ACCEPTED_MESSAGE =
  'Se o e-mail puder ser usado, você receberá uma mensagem com as próximas instruções.';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function invalidLink(): AppException {
  return new AppException(ErrorCode.TOKEN_INVALID, {
    status: 400,
    message: 'Link inválido ou expirado',
  });
}

function accountLocked(lockedUntil: Date, now: Date): AppException {
  const minutes = lockMinutesRemaining(lockedUntil, now);
  return new AppException(ErrorCode.ACCOUNT_LOCKED, {
    message: `Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em ${minutes} minuto${minutes === 1 ? '' : 's'}`,
  });
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly accessTokens: AccessTokenService,
    private readonly events: SecurityEventsService,
    private readonly mail: MailService,
  ) {}

  // ─────────────────────────── Cadastro e verificação ───────────────────────────

  /** Sempre "aceito" para o cliente (anti-enumeração); o e-mail enviado é que difere. */
  async register(dto: RegisterDto): Promise<void> {
    // Hash sempre calculado, para o tempo de resposta não revelar se o e-mail existe.
    const passwordHash = await this.passwords.hash(dto.password);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { name: true, deletedAt: true },
    });
    if (existing) {
      if (!existing.deletedAt) {
        await this.mail.send('ACCOUNT_ALREADY_EXISTS', dto.email, { name: existing.name });
      }
      return;
    }

    try {
      const trialDays = this.config.get('BILLING_TRIAL_DAYS');
      const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      const { user, token } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            passwordHash,
            categories: {
              createMany: {
                data: DEFAULT_CATEGORIES.map((category) => ({ ...category, isDefault: true })),
              },
            },
            subscription: { create: { trialEndsAt } },
          },
        });
        const secret = await this.issueToken(tx, created.id, 'EMAIL_VERIFICATION');
        return { user: created, token: secret };
      });
      await this.mail.send('EMAIL_VERIFICATION', user.email, {
        name: user.name,
        link: this.link('/verificar-email', token),
      });
    } catch (error) {
      // Cadastro concorrente com o mesmo e-mail: mesmo tratamento de "já existe".
      if (!isUniqueViolation(error)) throw error;
      await this.mail.send('ACCOUNT_ALREADY_EXISTS', dto.email);
    }
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.consumeToken(tx, token, 'EMAIL_VERIFICATION');
      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
    });
    return { verified: true };
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.emailVerifiedAt) return;
    const token = await this.issueToken(this.prisma, user.id, 'EMAIL_VERIFICATION');
    await this.mail.send('EMAIL_VERIFICATION', user.email, {
      name: user.name,
      link: this.link('/verificar-email', token),
    });
  }

  // ─────────────────────────── Login / refresh / logout ───────────────────────────

  async login(dto: LoginDto, context: ClientContext): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) {
      await this.passwords.verifyDummy(dto.password);
      await this.events.record({
        type: 'LOGIN_FAILED',
        email: dto.email,
        context,
        metadata: { reason: 'unknown_email' },
      });
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }

    const now = new Date();
    if (user.lockedUntil && isLocked(user, now)) {
      await this.events.record({
        type: 'LOGIN_FAILED',
        userId: user.id,
        email: user.email,
        context,
        metadata: { reason: 'locked' },
      });
      throw accountLocked(user.lockedUntil, now);
    }

    const valid = await this.passwords.verify(user.passwordHash, dto.password);
    if (!valid) {
      const next = registerFailure(user, this.lockoutConfig, now);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: next.failedLoginAttempts,
          lockoutCount: next.lockoutCount,
          lockedUntil: next.lockedUntil,
        },
      });
      await this.events.record({
        type: 'LOGIN_FAILED',
        userId: user.id,
        email: user.email,
        context,
        metadata: { reason: 'wrong_password', locked: next.lockedNow },
      });
      if (next.lockedNow && next.lockedUntil) {
        this.logger.warn(
          { userId: user.id, ip: context.ip, lockoutCount: next.lockoutCount },
          'Conta bloqueada por excesso de tentativas de login',
        );
        throw accountLocked(next.lockedUntil, now);
      }
      throw new AppException(ErrorCode.INVALID_CREDENTIALS);
    }

    const update: Prisma.UserUpdateInput = { ...CLEARED_LOCKOUT };
    if (this.passwords.needsRehash(user.passwordHash)) {
      update.passwordHash = await this.passwords.hash(dto.password);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: update });

    // Só revelado depois da senha correta.
    if (!user.emailVerifiedAt && this.config.get('AUTH_REQUIRE_EMAIL_VERIFICATION')) {
      throw new AppException(ErrorCode.EMAIL_NOT_VERIFIED);
    }

    const { session, refreshToken } = await this.sessions.create(user.id, context);
    await this.events.record({
      type: 'LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      context,
      metadata: { sessionId: session.id },
    });
    return this.buildResult(user, session.id, refreshToken, session.expiresAt);
  }

  async refresh(rawToken: string | undefined, context: ClientContext): Promise<AuthResult> {
    const { session, refreshToken } = await this.sessions.rotate(rawToken, context);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    return this.buildResult(user, session.id, refreshToken, session.expiresAt);
  }

  /** Idempotente: encerra a sessão do cookie (ou do bearer, mesmo expirado) se houver. */
  async logout(
    rawRefreshToken: string | undefined,
    bearer: string | undefined,
    context: ClientContext,
  ): Promise<void> {
    let target: { sessionId: string; userId: string } | null = null;

    const fromCookie = await this.sessions.findByRefreshToken(rawRefreshToken);
    if (fromCookie) target = { sessionId: fromCookie.id, userId: fromCookie.userId };

    if (!target && bearer) {
      try {
        const payload = await this.accessTokens.verify(bearer, { ignoreExpiration: true });
        target = { sessionId: payload.sid, userId: payload.sub };
      } catch {
        target = null;
      }
    }

    if (!target) return;
    const revoked = await this.sessions.revoke(target.sessionId, target.userId);
    if (revoked) {
      await this.events.record({
        type: 'LOGOUT',
        userId: target.userId,
        context,
        metadata: { sessionId: target.sessionId },
      });
    }
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new AppException(ErrorCode.UNAUTHORIZED);
    return toUserDto(user);
  }

  // ─────────────────────────── Senha ───────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return;
    const token = await this.issueToken(this.prisma, user.id, 'PASSWORD_RESET');
    await this.mail.send('PASSWORD_RESET', user.email, {
      name: user.name,
      link: this.link('/redefinir-senha', token),
    });
  }

  async resetPassword(dto: ResetPasswordDto, context: ClientContext): Promise<{ reset: true }> {
    const passwordHash = await this.passwords.hash(dto.password);
    const { user, revoked } = await this.prisma.$transaction(async (tx) => {
      const userId = await this.consumeToken(tx, dto.token, 'PASSWORD_RESET');
      const now = new Date();
      await tx.verificationToken.updateMany({
        where: { userId, type: 'PASSWORD_RESET', usedAt: null },
        data: { usedAt: now },
      });
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          ...CLEARED_LOCKOUT,
          // O link chegou na caixa de entrada: o e-mail está comprovado.
          emailVerifiedAt: current.emailVerifiedAt ?? now,
        },
      });
      const count = await this.sessions.revokeAllForUser(userId, undefined, tx);
      return { user: updated, revoked: count };
    });

    await this.events.record({
      type: 'PASSWORD_CHANGED',
      userId: user.id,
      context,
      metadata: { via: 'reset', revokedSessions: revoked },
    });
    await this.mail.send('PASSWORD_CHANGED', user.email, { name: user.name });
    return { reset: true };
  }

  async changePassword(
    auth: AuthUser,
    dto: ChangePasswordDto,
    context: ClientContext,
  ): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: auth.id } });
    if (!user || user.deletedAt) throw new AppException(ErrorCode.UNAUTHORIZED);

    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new AppException(ErrorCode.INVALID_PASSWORD, {
        details: [{ field: 'currentPassword', message: 'Senha atual incorreta' }],
      });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'newPassword', message: 'A nova senha deve ser diferente da atual' }],
      });
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    const revoked = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      return this.sessions.revokeAllForUser(user.id, auth.sessionId, tx);
    });

    await this.events.record({
      type: 'PASSWORD_CHANGED',
      userId: user.id,
      context,
      metadata: { via: 'change', revokedSessions: revoked },
    });
    await this.mail.send('PASSWORD_CHANGED', user.email, { name: user.name });
    return { changed: true };
  }

  // ─────────────────────────── Sessões ───────────────────────────

  async listSessions(auth: AuthUser): Promise<SessionDto[]> {
    const sessions = await this.sessions.listActive(auth.id);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
      current: s.id === auth.sessionId,
    }));
  }

  /** Revoga uma sessão ativa do próprio usuário. Retorna true se era a sessão atual. */
  async revokeSession(auth: AuthUser, sessionId: string, context: ClientContext): Promise<boolean> {
    if (!isUuid(sessionId) || !(await this.sessions.revoke(sessionId, auth.id))) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Sessão não encontrada' });
    }
    await this.events.record({
      type: 'SESSION_REVOKED',
      userId: auth.id,
      context,
      metadata: { sessionId },
    });
    return sessionId === auth.sessionId;
  }

  async revokeOtherSessions(auth: AuthUser, context: ClientContext): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeAllForUser(auth.id, auth.sessionId);
    if (revoked > 0) {
      await this.events.record({
        type: 'SESSION_REVOKED',
        userId: auth.id,
        context,
        metadata: { scope: 'others', revoked },
      });
    }
    return { revoked };
  }

  // ─────────────────────────── Internos ───────────────────────────

  private get lockoutConfig() {
    return {
      maxFailedAttempts: this.config.get('AUTH_MAX_FAILED_ATTEMPTS'),
      lockoutMinutes: this.config.get('AUTH_LOCKOUT_MINUTES'),
    };
  }

  private async buildResult(
    user: User,
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): Promise<AuthResult> {
    const { accessToken, expiresIn } = await this.accessTokens.sign(user.id, sessionId);
    return {
      payload: { accessToken, expiresIn, user: toUserDto(user) },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private link(path: string, token: string): string {
    return `${this.mail.appUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  /** Cria token de uso único (só o hash é salvo) e invalida os anteriores do mesmo tipo. */
  private async issueToken(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    type: VerificationTokenType,
  ): Promise<string> {
    const now = new Date();
    const ttl = type === 'PASSWORD_RESET' ? PASSWORD_RESET_TTL_MS : EMAIL_VERIFICATION_TTL_MS;
    await db.verificationToken.updateMany({
      where: { userId, type, usedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });
    const secret = generateSecret();
    await db.verificationToken.create({
      data: { userId, type, tokenHash: sha256(secret), expiresAt: new Date(now.getTime() + ttl) },
    });
    return secret;
  }

  /** Marca o token como usado de forma atômica e devolve o userId; senão 400 TOKEN_INVALID. */
  private async consumeToken(
    tx: Prisma.TransactionClient,
    rawToken: string,
    type: VerificationTokenType,
  ): Promise<string> {
    const now = new Date();
    const record = await tx.verificationToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: { select: { deletedAt: true } } },
    });
    if (
      !record ||
      record.type !== type ||
      record.usedAt ||
      record.expiresAt.getTime() <= now.getTime() ||
      record.user.deletedAt
    ) {
      throw invalidLink();
    }
    const { count } = await tx.verificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (count !== 1) throw invalidLink();
    return record.userId;
  }
}
