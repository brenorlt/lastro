import type { CookieOptions, Request, Response } from 'express';
import type { AppConfigService } from '../../config/app-config.service.js';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  SESSION_INDICATOR_COOKIE,
} from '../auth.constants.js';

function baseOptions(config: AppConfigService): CookieOptions {
  return {
    secure: config.isProductionLike,
    domain: config.get('COOKIE_DOMAIN'),
  };
}

/**
 * `lastro_rt`: refresh token, httpOnly, SameSite=Strict, restrito a /api/auth.
 * `lastro_session=1`: indicador sem segredo (legível pelo frontend só para UX de redirecionamento).
 * Ambos expiram junto com a família de sessões.
 */
export function setSessionCookies(
  res: Response,
  config: AppConfigService,
  refreshToken: string,
  expiresAt: Date,
): void {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  const base = baseOptions(config);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    httpOnly: true,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge,
  });
  res.cookie(SESSION_INDICATOR_COOKIE, '1', {
    ...base,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function clearSessionCookies(res: Response, config: AppConfigService): void {
  const base = baseOptions(config);
  res.clearCookie(REFRESH_COOKIE, {
    ...base,
    httpOnly: true,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  });
  res.clearCookie(SESSION_INDICATOR_COOKIE, { ...base, sameSite: 'lax', path: '/' });
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
