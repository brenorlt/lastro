import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { durationToSeconds } from '../../common/utils/duration.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, Session } from '../../generated/prisma/client.js';
import { LAST_USED_UPDATE_INTERVAL_MS } from '../auth.constants.js';
import type { ClientContext } from '../security/client-context.js';
import { SecurityEventsService } from '../security/security-events.service.js';
import {
  formatRefreshToken,
  generateSecret,
  parseRefreshToken,
  safeEqualHex,
  sha256,
} from '../tokens/token.util.js';

export interface IssuedSession {
  session: Session;
  /** Valor do cookie `lastro_rt` — nunca persistido nem logado. */
  refreshToken: string;
}

type Db = Pick<PrismaService, 'session'> | Prisma.TransactionClient;

class ConcurrentRotationError extends Error {}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  /** Vida absoluta da família de sessões, contada a partir do login. */
  readonly familyLifetimeMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: SecurityEventsService,
    config: AppConfigService,
  ) {
    this.familyLifetimeMs = durationToSeconds(config.get('JWT_REFRESH_TTL')) * 1000;
  }

  /** Nova sessão (nova família) após login. */
  async create(
    userId: string,
    context: ClientContext,
    db: Db = this.prisma,
  ): Promise<IssuedSession> {
    const now = new Date();
    return this.insert(db, {
      userId,
      familyId: randomUUID(),
      expiresAt: new Date(now.getTime() + this.familyLifetimeMs),
      context,
      now,
    });
  }

  /**
   * Rotação do refresh token. Cria uma sessão nova na mesma família (mesmo expiresAt
   * absoluto) e revoga a atual apontando `replacedById`. Apresentar um token já revogado
   * é tratado como roubo: toda a família é revogada.
   */
  async rotate(rawToken: unknown, context: ClientContext): Promise<IssuedSession> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) throw new AppException(ErrorCode.UNAUTHORIZED);

    const current = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { user: { select: { deletedAt: true } } },
    });
    if (!current || !safeEqualHex(sha256(parsed.secret), current.refreshTokenHash)) {
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    const now = new Date();
    if (current.revokedAt) {
      // Só um token já *rotacionado* indica roubo; sessões encerradas por logout/revogação
      // apenas respondem SESSION_REVOKED.
      if (current.replacedById) await this.handleReuse(current, context);
      throw new AppException(ErrorCode.SESSION_REVOKED);
    }
    if (current.expiresAt.getTime() <= now.getTime()) {
      throw new AppException(ErrorCode.SESSION_EXPIRED);
    }
    if (current.user.deletedAt) {
      await this.revoke(current.id);
      throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const issued = await this.insert(tx, {
          userId: current.userId,
          familyId: current.familyId,
          expiresAt: current.expiresAt,
          context,
          now,
        });
        // Condicional: se outra requisição rotacionou primeiro, count = 0.
        const { count } = await tx.session.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: now, replacedById: issued.session.id },
        });
        if (count !== 1) throw new ConcurrentRotationError();
        return issued;
      });
    } catch (error) {
      if (!(error instanceof ConcurrentRotationError)) throw error;
      await this.handleReuse(current, context);
      throw new AppException(ErrorCode.SESSION_REVOKED);
    }
  }

  /** Revoga uma sessão (opcionalmente restrita ao dono). Retorna true se algo foi revogado. */
  async revoke(sessionId: string, userId?: string): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null, ...(userId ? { userId } : {}) },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  async revokeFamily(familyId: string, db: Db = this.prisma): Promise<number> {
    const { count } = await db.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string, db: Db = this.prisma) {
    const { count } = await db.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  listActive(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    });
  }

  /** Estado mínimo para o JwtAuthGuard (lookup por PK). */
  findForAccessCheck(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        lastUsedAt: true,
        user: { select: { deletedAt: true } },
      },
    });
  }

  /** Atualiza lastUsedAt no máximo a cada 5 minutos (fire-and-forget). */
  touch(sessionId: string, lastUsedAt: Date | null): void {
    const now = Date.now();
    if (lastUsedAt && now - lastUsedAt.getTime() < LAST_USED_UPDATE_INTERVAL_MS) return;
    this.prisma.session
      .updateMany({ where: { id: sessionId }, data: { lastUsedAt: new Date(now) } })
      .catch((error: unknown) =>
        this.logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'touch'),
      );
  }

  /** Valida um refresh token sem rotacioná-lo (usado no logout). */
  async findByRefreshToken(rawToken: unknown): Promise<Session | null> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) return null;
    const session = await this.prisma.session.findUnique({ where: { id: parsed.sessionId } });
    if (!session || !safeEqualHex(sha256(parsed.secret), session.refreshTokenHash)) return null;
    return session;
  }

  private async handleReuse(session: Session, context: ClientContext): Promise<void> {
    const revoked = await this.revokeFamily(session.familyId);
    this.logger.warn(
      { userId: session.userId, familyId: session.familyId, revoked, ip: context.ip },
      'Reuso de refresh token detectado: família de sessões revogada',
    );
    await this.events.record({
      type: 'REFRESH_REUSE_DETECTED',
      userId: session.userId,
      context,
      metadata: { familyId: session.familyId, sessionId: session.id, revoked },
    });
  }

  private async insert(
    db: Db,
    input: { userId: string; familyId: string; expiresAt: Date; context: ClientContext; now: Date },
  ): Promise<IssuedSession> {
    const id = randomUUID();
    const secret = generateSecret();
    const session = await db.session.create({
      data: {
        id,
        userId: input.userId,
        familyId: input.familyId,
        refreshTokenHash: sha256(secret),
        userAgent: input.context.userAgent,
        ip: input.context.ip,
        expiresAt: input.expiresAt,
        lastUsedAt: input.now,
      },
    });
    return { session, refreshToken: formatRefreshToken(id, secret) };
  }
}
