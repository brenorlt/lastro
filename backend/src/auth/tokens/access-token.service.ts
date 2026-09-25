import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { AccessTokenPayload } from '../../common/types/auth-user.js';
import { durationToSeconds } from '../../common/utils/duration.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../auth.constants.js';
import { isUuid } from './token.util.js';

function isAccessPayload(payload: unknown): payload is AccessTokenPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.sub === 'string' && typeof p.sid === 'string' && isUuid(p.sid) && p.typ === 'access'
  );
}

@Injectable()
export class AccessTokenService {
  readonly expiresInSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.expiresInSeconds = durationToSeconds(config.get('JWT_ACCESS_TTL'));
  }

  async sign(
    userId: string,
    sessionId: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, typ: 'access' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      algorithm: 'HS256',
      expiresIn: this.expiresInSeconds,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return { accessToken, expiresIn: this.expiresInSeconds };
  }

  /** Valida assinatura, iss, aud e typ. Expirado → TOKEN_EXPIRED; qualquer outro problema → TOKEN_INVALID. */
  async verify(
    token: string,
    options: { ignoreExpiration?: boolean } = {},
  ): Promise<AccessTokenPayload> {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync<object>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        ignoreExpiration: options.ignoreExpiration ?? false,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppException(ErrorCode.TOKEN_EXPIRED);
      }
      throw new AppException(ErrorCode.TOKEN_INVALID);
    }
    if (!isAccessPayload(payload)) throw new AppException(ErrorCode.TOKEN_INVALID);
    return payload;
  }
}

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
