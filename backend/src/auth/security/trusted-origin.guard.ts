import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { AppConfigService } from '../../config/app-config.service.js';

const TRUSTED_ORIGIN_KEY = 'trustedOrigin';

interface TrustedOriginOptions {
  /** Aceita requisições sem Origin nem Referer (clientes não-browser). */
  allowMissing: boolean;
}

/**
 * Proteção CSRF para rotas autenticadas por cookie: Origin (ou, na falta, Referer)
 * precisa estar em CORS_ORIGINS ou ser a origem de APP_URL.
 */
export const RequireTrustedOrigin = (options: TrustedOriginOptions) =>
  SetMetadata(TRUSTED_ORIGIN_KEY, options);

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  private readonly logger = new Logger(TrustedOriginGuard.name);
  private readonly allowed: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    config: AppConfigService,
  ) {
    const origins = [...config.get('CORS_ORIGINS'), config.get('APP_URL')]
      .map(toOrigin)
      .filter((o): o is string => o !== null);
    this.allowed = new Set(origins);
  }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<TrustedOriginOptions | undefined>(
      TRUSTED_ORIGIN_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source =
      typeof origin === 'string' && origin !== 'null'
        ? toOrigin(origin)
        : typeof referer === 'string'
          ? toOrigin(referer)
          : undefined;

    if (source === undefined && options.allowMissing) return true;
    if (source && this.allowed.has(source)) return true;

    this.logger.warn({ origin: origin ?? null, path: req.originalUrl }, 'Origem rejeitada (CSRF)');
    throw new AppException(ErrorCode.CSRF_REJECTED);
  }
}
