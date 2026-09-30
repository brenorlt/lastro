import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppConfigService } from '../../config/app-config.service.js';
import { generateSecret } from '../tokens/token.util.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const STATE_AUDIENCE = 'lastro-oauth-state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

/** Identidade extraída de um id_token do Google já validado. */
export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/** Guardado (assinado) no cookie do fluxo entre o redirect e o callback. */
export interface OAuthFlowState {
  state: string;
  nonce: string;
  codeVerifier: string;
  next: string | null;
}

export class GoogleOAuthError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GoogleOAuthError';
  }
}

/**
 * Authorization Code + PKCE com o Google (OpenID Connect). Só o protocolo: quem é o usuário no
 * Lastro é decidido em AuthService.loginWithGoogle.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly jwks = createRemoteJWKSet(new URL(JWKS_URL));

  constructor(
    private readonly config: AppConfigService,
    private readonly jwt: JwtService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET'));
  }

  /** Passa pelo proxy do Next (same-origin), então os cookies do callback são first-party. */
  get redirectUri(): string {
    return `${new URL(this.config.get('APP_URL')).origin}/api/auth/google/callback`;
  }

  /** Inicia o fluxo: URL do Google + estado assinado para o cookie. */
  async start(next: string | null): Promise<{ url: string; cookie: string }> {
    const flow: OAuthFlowState = {
      state: generateSecret(),
      nonce: generateSecret(),
      codeVerifier: generateSecret(),
      next,
    };
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: createHash('sha256').update(flow.codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    const cookie = await this.jwt.signAsync(
      { ...flow },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        audience: STATE_AUDIENCE,
        expiresIn: OAUTH_STATE_TTL_SECONDS,
      },
    );
    return { url: url.toString(), cookie };
  }

  /** Confere o cookie do fluxo contra o `state` devolvido pelo Google. */
  async readFlow(cookie: string | undefined, state: string | undefined): Promise<OAuthFlowState> {
    if (!cookie || !state) throw new GoogleOAuthError('missing_state');
    let flow: OAuthFlowState;
    try {
      flow = await this.jwt.verifyAsync<OAuthFlowState>(cookie, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        audience: STATE_AUDIENCE,
      });
    } catch {
      throw new GoogleOAuthError('invalid_state_cookie');
    }
    if (flow.state !== state) throw new GoogleOAuthError('state_mismatch');
    return flow;
  }

  /** Troca o `code` pelo id_token e o valida (assinatura, iss, aud, exp, nonce). */
  async exchangeCode(code: string, flow: OAuthFlowState): Promise<GoogleProfile> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.config.get('GOOGLE_CLIENT_SECRET') ?? '',
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: flow.codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // O corpo só traz o código de erro do Google (ex.: invalid_grant), nunca segredos.
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      this.logger.warn({ status: response.status, error: body.error }, 'Troca de código recusada');
      throw new GoogleOAuthError('token_exchange_failed');
    }
    const { id_token: idToken } = (await response.json()) as { id_token?: string };
    if (!idToken) throw new GoogleOAuthError('missing_id_token');

    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: ISSUERS,
      audience: this.clientId,
    }).catch(() => {
      throw new GoogleOAuthError('invalid_id_token');
    });
    if (payload.nonce !== flow.nonce) throw new GoogleOAuthError('nonce_mismatch');
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new GoogleOAuthError('missing_claims');
    }

    const email = payload.email.trim().toLowerCase();
    return {
      sub: payload.sub,
      email,
      emailVerified: payload.email_verified === true,
      name:
        typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim()
          : email.split('@')[0],
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }

  private get clientId(): string {
    return this.config.get('GOOGLE_CLIENT_ID') ?? '';
  }
}
