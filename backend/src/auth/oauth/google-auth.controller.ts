import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipBilling } from '../../common/decorators/skip-billing.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AuthService } from '../auth.service.js';
import { clientContext } from '../security/client-context.js';
import { setSessionCookies } from '../sessions/auth-cookies.js';
import {
  GoogleOAuthError,
  GoogleOAuthService,
  OAUTH_STATE_TTL_SECONDS,
} from './google-oauth.service.js';
import { safeNext } from './safe-next.js';

export const OAUTH_STATE_COOKIE = 'lastro_oauth';
const OAUTH_COOKIE_PATH = '/api/auth/google';
const THROTTLE = { default: { limit: 20, ttl: 60_000 } };

/** Códigos lidos por /entrar?erro=… no frontend. */
type LoginError =
  | 'google_indisponivel'
  | 'google_cancelado'
  | 'google_email_nao_verificado'
  | 'google_conta_indisponivel'
  | 'google_falhou';

/**
 * Login com Google (navegação de página inteira, não XHR): toda resposta é um redirect —
 * para o Google, para a área logada ou de volta para /entrar com `?erro=`.
 */
@ApiExcludeController()
@Public()
@SkipBilling()
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly google: GoogleOAuthService,
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  @Throttle(THROTTLE)
  async start(@Query('next') next: unknown, @Res() res: Response): Promise<void> {
    if (!this.google.enabled) return this.fail(res, 'google_indisponivel');
    const { url, cookie } = await this.google.start(safeNext(next));
    res.cookie(OAUTH_STATE_COOKIE, cookie, {
      ...this.stateCookieOptions(),
      maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }

  @Get('callback')
  @Throttle(THROTTLE)
  async callback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') error: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const rawFlow = cookies?.[OAUTH_STATE_COOKIE];
    // Uso único: o cookie sai já nesta resposta, qualquer que seja o resultado.
    res.clearCookie(OAUTH_STATE_COOKIE, this.stateCookieOptions());
    res.setHeader('Cache-Control', 'no-store');

    if (!this.google.enabled) return this.fail(res, 'google_indisponivel');
    if (error === 'access_denied') return this.fail(res, 'google_cancelado');

    try {
      if (typeof code !== 'string' || !code) throw new GoogleOAuthError('missing_code');
      const flow = await this.google.readFlow(
        typeof rawFlow === 'string' ? rawFlow : undefined,
        typeof state === 'string' ? state : undefined,
      );
      const profile = await this.google.exchangeCode(code, flow);
      const result = await this.auth.loginWithGoogle(profile, clientContext(req));
      setSessionCookies(res, this.config, result.refreshToken, result.refreshExpiresAt);

      const destination = result.payload.user.onboardingCompleted
        ? (flow.next ?? '/painel')
        : '/onboarding';
      res.redirect(302, this.appUrl(destination));
    } catch (err) {
      if (err instanceof AppException && err.code === ErrorCode.EMAIL_NOT_VERIFIED) {
        return this.fail(res, 'google_email_nao_verificado');
      }
      if (err instanceof AppException && err.code === ErrorCode.UNAUTHORIZED) {
        return this.fail(res, 'google_conta_indisponivel');
      }
      const reason = err instanceof GoogleOAuthError ? err.message : 'unexpected';
      this.logger.warn(
        { reason, err: err instanceof GoogleOAuthError ? undefined : err },
        'Login com Google falhou',
      );
      this.fail(res, 'google_falhou');
    }
  }

  private fail(res: Response, code: LoginError): void {
    res.redirect(302, this.appUrl(`/entrar?erro=${code}`));
  }

  private appUrl(path: string): string {
    return `${new URL(this.config.get('APP_URL')).origin}${path}`;
  }

  /** SameSite=Lax: o callback chega por navegação vinda de accounts.google.com. */
  private stateCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProductionLike,
      domain: this.config.get('COOKIE_DOMAIN'),
      path: OAUTH_COOKIE_PATH,
    };
  }
}
