import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenService, extractBearerToken } from '../auth/tokens/access-token.service.js';
import { SessionService } from '../auth/sessions/session.service.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { AppRequest } from '../common/types/http.js';

/**
 * Guard global: toda rota exige Bearer access token válido (assinatura, iss, aud, typ)
 * e sessão ativa no banco — revogar a sessão invalida o access token imediatamente.
 * Rotas com @Public() são liberadas.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new AppException(ErrorCode.UNAUTHORIZED);

    const payload = await this.accessTokens.verify(token);
    const session = await this.sessions.findForAccessCheck(payload.sid);

    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new AppException(ErrorCode.SESSION_REVOKED);
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppException(ErrorCode.SESSION_EXPIRED);
    }
    if (session.user.deletedAt) throw new AppException(ErrorCode.UNAUTHORIZED);

    this.sessions.touch(payload.sid, session.lastUsedAt);
    request.user = { id: payload.sub, sessionId: payload.sid };
    return true;
  }
}
