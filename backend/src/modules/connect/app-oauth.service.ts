import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { generateSecret, sha256 } from '../../auth/tokens/token.util.js';
import { SecurityEventsService } from '../../auth/security/security-events.service.js';
import type { ClientContext } from '../../auth/security/client-context.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';

/** Único escopo hoje: ler e registrar finanças pelo conector. */
export const APP_SCOPE = 'financas';

const CODE_TTL_MS = 10 * 60_000;
const ACCESS_TTL_MS = 60 * 60_000;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60_000;
const ACCESS_PREFIX = 'lst_at_';
const REFRESH_PREFIX = 'lst_rt_';
const CODE_PREFIX = 'lst_ac_';
const MAX_REDIRECT_URIS = 10;

/** Erro no formato do RFC 6749 §5.2 / RFC 7591 §3.2.2. */
export class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
  }
}

export interface AuthorizeParams {
  responseType?: string;
  clientId?: string;
  redirectUri?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope?: string;
  state?: string;
  resource?: string;
}

export interface TokenPair {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface AppPrincipal {
  userId: string;
  connectionId: string;
}

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * redirect_uri aceito: https em qualquer host ou http só em loopback (RFC 8252 §7.3).
 * Fragmento nunca; credenciais na URL nunca.
 */
export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

/** Loopback: a porta pode variar a cada execução do cliente nativo (RFC 8252 §7.3). */
function redirectMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true;
  try {
    const a = new URL(registered);
    const b = new URL(requested);
    const loopback = ['localhost', '127.0.0.1', '[::1]'];
    return (
      a.protocol === 'http:' &&
      loopback.includes(a.hostname) &&
      a.hostname === b.hostname &&
      a.pathname === b.pathname &&
      a.search === b.search
    );
  } catch {
    return false;
  }
}

/** PKCE S256: BASE64URL(SHA256(verifier)) === challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash('sha256').update(verifier).digest('base64url') === challenge;
}

/**
 * Servidor de autorização OAuth 2.1 do Lastro para apps conectados (clientes MCP).
 * Clientes públicos (sem segredo), PKCE S256 obrigatório, tokens opacos guardados como hash,
 * refresh rotativo com detecção de reuso.
 */
@Injectable()
export class AppOAuthService {
  private readonly logger = new Logger(AppOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  /** Origem pública (frontend que faz proxy de /api): emissor e base dos endpoints. */
  get issuer(): string {
    return this.config.get('APP_URL').replace(/\/+$/, '');
  }

  get resource(): string {
    return `${this.issuer}/api/mcp`;
  }

  get resourceMetadataUrl(): string {
    return `${this.issuer}/.well-known/oauth-protected-resource/api/mcp`;
  }

  authorizationServerMetadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/api/oauth/authorize`,
      token_endpoint: `${this.issuer}/api/oauth/token`,
      registration_endpoint: `${this.issuer}/api/oauth/register`,
      revocation_endpoint: `${this.issuer}/api/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [APP_SCOPE],
    };
  }

  protectedResourceMetadata() {
    return {
      resource: this.resource,
      authorization_servers: [this.issuer],
      scopes_supported: [APP_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Lastro',
    };
  }

  // -------------------------------------------------------------------------
  // Registro dinâmico (RFC 7591)

  async register(body: unknown) {
    const input = (body ?? {}) as Record<string, unknown>;
    const uris = input.redirect_uris;
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
      throw new OAuthError('invalid_redirect_uri', 'Informe de 1 a 10 redirect_uris.');
    }
    if (
      !uris.every(
        (u): u is string => typeof u === 'string' && u.length <= 2048 && isAllowedRedirectUri(u),
      )
    ) {
      throw new OAuthError(
        'invalid_redirect_uri',
        'redirect_uri deve ser https ou http em localhost.',
      );
    }
    const authMethod = input.token_endpoint_auth_method;
    if (authMethod !== undefined && authMethod !== 'none') {
      throw new OAuthError(
        'invalid_client_metadata',
        'Somente clientes públicos (token_endpoint_auth_method "none").',
      );
    }
    const rawName = typeof input.client_name === 'string' ? input.client_name.trim() : '';
    const name = (rawName || new URL(uris[0]).hostname).slice(0, 120);

    const client = await this.prisma.appClient.create({ data: { name, redirectUris: uris } });
    return {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: APP_SCOPE,
    };
  }

  // -------------------------------------------------------------------------
  // Autorização

  /**
   * Valida o pedido de autorização. Erros no client/redirect_uri NUNCA redirecionam
   * (o redirect_uri não é confiável); os demais voltam ao cliente via redirect.
   */
  async validateAuthorize(p: AuthorizeParams) {
    if (!p.clientId || !isUuid(p.clientId))
      throw new OAuthError('invalid_client', 'Aplicativo desconhecido.');
    const client = await this.prisma.appClient.findUnique({ where: { id: p.clientId } });
    if (!client) throw new OAuthError('invalid_client', 'Aplicativo desconhecido.');
    const redirectUri =
      p.redirectUri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
    if (!redirectUri || !client.redirectUris.some((r) => redirectMatches(r, redirectUri))) {
      throw new OAuthError(
        'invalid_request',
        'Endereço de retorno não autorizado para este aplicativo.',
      );
    }

    const redirectError = (error: string, description: string) => ({
      redirectUri,
      error,
      description,
    });
    if (p.responseType !== 'code')
      return {
        client,
        redirectUri,
        problem: redirectError('unsupported_response_type', 'Use response_type=code.'),
      };
    if (
      !p.codeChallenge ||
      p.codeChallengeMethod !== 'S256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(p.codeChallenge)
    ) {
      return {
        client,
        redirectUri,
        problem: redirectError('invalid_request', 'PKCE S256 é obrigatório.'),
      };
    }
    const scopes = (p.scope ?? APP_SCOPE).split(' ').filter(Boolean);
    if (scopes.some((s) => s !== APP_SCOPE)) {
      return {
        client,
        redirectUri,
        problem: redirectError('invalid_scope', `Escopo suportado: ${APP_SCOPE}.`),
      };
    }
    if (p.resource && p.resource.replace(/\/+$/, '') !== this.resource) {
      return {
        client,
        redirectUri,
        problem: redirectError('invalid_target', 'Recurso desconhecido.'),
      };
    }
    return { client, redirectUri, problem: null };
  }

  /** A pessoa respondeu na tela de consentimento. Devolve para onde o navegador deve ir. */
  async decide(
    userId: string,
    p: AuthorizeParams,
    approve: boolean,
    ctx: ClientContext,
  ): Promise<string> {
    const { client, redirectUri, problem } = await this.validateAuthorize(p);
    const back = new URL(redirectUri);
    if (p.state) back.searchParams.set('state', p.state);
    back.searchParams.set('iss', this.issuer);

    if (problem) {
      back.searchParams.set('error', problem.error);
      back.searchParams.set('error_description', problem.description);
      return back.toString();
    }
    if (!approve) {
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('error_description', 'A pessoa recusou o acesso.');
      return back.toString();
    }

    const code = CODE_PREFIX + generateSecret();
    await this.prisma.appAuthorizationCode.create({
      data: {
        codeHash: sha256(code),
        clientId: client.id,
        userId,
        redirectUri,
        codeChallenge: p.codeChallenge!,
        scope: APP_SCOPE,
        resource: p.resource ?? null,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    void this.securityEvents.record({
      type: 'APP_CONNECTED',
      userId,
      context: ctx,
      metadata: { client: client.name },
    });
    back.searchParams.set('code', code);
    return back.toString();
  }

  // -------------------------------------------------------------------------
  // Token endpoint

  async token(body: Record<string, unknown>): Promise<TokenPair> {
    const grant = body.grant_type;
    if (grant === 'authorization_code') return this.exchangeCode(body);
    if (grant === 'refresh_token') return this.refresh(body);
    throw new OAuthError('unsupported_grant_type', 'Use authorization_code ou refresh_token.');
  }

  private async exchangeCode(body: Record<string, unknown>): Promise<TokenPair> {
    const code = typeof body.code === 'string' ? body.code : '';
    const verifier = typeof body.code_verifier === 'string' ? body.code_verifier : '';
    const clientId = typeof body.client_id === 'string' ? body.client_id : '';
    if (!code || !verifier)
      throw new OAuthError('invalid_request', 'code e code_verifier são obrigatórios.');

    const record = await this.prisma.appAuthorizationCode.findUnique({
      where: { codeHash: sha256(code) },
    });
    const invalid = new OAuthError('invalid_grant', 'Código inválido ou expirado.');
    if (!record) throw invalid;

    // Uso único: marca antes de qualquer outra checagem; reuso não emite nada.
    const claimed = await this.prisma.appAuthorizationCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0 || record.expiresAt.getTime() <= Date.now()) throw invalid;
    if (clientId && clientId !== record.clientId) throw invalid;
    if (typeof body.redirect_uri === 'string' && body.redirect_uri !== record.redirectUri)
      throw invalid;
    if (!pkceMatches(verifier, record.codeChallenge)) throw invalid;

    // Reconectar o mesmo app substitui a conexão anterior (sem duplicatas em "Apps conectados").
    const previous = await this.prisma.appConnection.findMany({
      where: { userId: record.userId, clientId: record.clientId, revokedAt: null },
      select: { id: true },
    });
    if (previous.length > 0) {
      const ids = previous.map((c) => c.id);
      await this.prisma.appConnection.updateMany({
        where: { id: { in: ids } },
        data: { revokedAt: new Date() },
      });
      await this.prisma.appToken.deleteMany({ where: { connectionId: { in: ids } } });
    }
    const connection = await this.prisma.appConnection.create({
      data: { userId: record.userId, clientId: record.clientId, scope: record.scope },
    });
    return this.issuePair(connection.id, connection.scope);
  }

  private async refresh(body: Record<string, unknown>): Promise<TokenPair> {
    const raw = typeof body.refresh_token === 'string' ? body.refresh_token : '';
    const invalid = new OAuthError('invalid_grant', 'Refresh token inválido ou expirado.');
    if (!raw.startsWith(REFRESH_PREFIX)) throw invalid;

    const token = await this.prisma.appToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { connection: { include: { user: { select: { deletedAt: true } } } } },
    });
    if (!token || token.kind !== 'REFRESH') throw invalid;
    const { connection } = token;
    if (typeof body.client_id === 'string' && body.client_id !== connection.clientId) throw invalid;
    if (connection.revokedAt || connection.user.deletedAt) throw invalid;

    const claimed = await this.prisma.appToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      // Refresh já usado reapresentado: provável vazamento. Derruba a conexão inteira.
      await this.revokeConnection(connection.userId, connection.id, 'refresh_reuse');
      this.logger.warn({ connectionId: connection.id }, 'Reuso de refresh token de app conectado');
      throw invalid;
    }
    if (token.expiresAt.getTime() <= Date.now()) throw invalid;
    return this.issuePair(connection.id, connection.scope);
  }

  private async issuePair(connectionId: string, scope: string): Promise<TokenPair> {
    const access = ACCESS_PREFIX + generateSecret();
    const refresh = REFRESH_PREFIX + generateSecret();
    const now = Date.now();
    await this.prisma.appToken.createMany({
      data: [
        {
          connectionId,
          kind: 'ACCESS',
          tokenHash: sha256(access),
          expiresAt: new Date(now + ACCESS_TTL_MS),
        },
        {
          connectionId,
          kind: 'REFRESH',
          tokenHash: sha256(refresh),
          expiresAt: new Date(now + REFRESH_TTL_MS),
        },
      ],
    });
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_MS / 1000,
      refresh_token: refresh,
      scope,
    };
  }

  /** RFC 7009: sempre 200, mesmo para token desconhecido. Revoga a conexão inteira. */
  async revokeToken(raw: unknown): Promise<void> {
    if (
      typeof raw !== 'string' ||
      !(raw.startsWith(ACCESS_PREFIX) || raw.startsWith(REFRESH_PREFIX))
    )
      return;
    const token = await this.prisma.appToken.findUnique({
      where: { tokenHash: sha256(raw) },
      select: { connection: { select: { id: true, userId: true } } },
    });
    if (token) await this.revokeConnection(token.connection.userId, token.connection.id, 'client');
  }

  // -------------------------------------------------------------------------
  // Recurso protegido (/api/mcp)

  /** Valida o Bearer de um app conectado. null = 401. */
  async authenticate(header: string | undefined): Promise<AppPrincipal | null> {
    const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
    const raw = match?.[1];
    if (!raw?.startsWith(ACCESS_PREFIX)) return null;
    const token = await this.prisma.appToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { connection: { include: { user: { select: { deletedAt: true } } } } },
    });
    if (!token || token.kind !== 'ACCESS' || token.expiresAt.getTime() <= Date.now()) return null;
    const { connection } = token;
    if (connection.revokedAt || connection.user.deletedAt) return null;

    // Último uso com resolução de minutos: evita uma escrita por chamada de ferramenta.
    if (!connection.lastUsedAt || Date.now() - connection.lastUsedAt.getTime() > 60_000) {
      void this.prisma.appConnection
        .update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    return { userId: connection.userId, connectionId: connection.id };
  }

  async isBlocked(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { status: true },
    });
    return sub?.status === 'BLOCKED';
  }

  // -------------------------------------------------------------------------
  // Gestão pela pessoa (Perfil → Apps conectados)

  async listConnections(userId: string) {
    const rows = await this.prisma.appConnection.findMany({
      where: { userId, revokedAt: null },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => ({
      id: c.id,
      appName: c.client.name,
      scope: c.scope,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
    }));
  }

  /** Revoga a conexão e apaga seus tokens. Idempotente. */
  async revokeConnection(
    userId: string,
    connectionId: string,
    reason: string,
    ctx?: ClientContext,
  ): Promise<boolean> {
    const updated = await this.prisma.appConnection.updateMany({
      where: { id: connectionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.appToken.deleteMany({ where: { connectionId, connection: { userId } } });
    if (updated.count > 0) {
      void this.securityEvents.record({
        type: 'APP_DISCONNECTED',
        userId,
        context: ctx,
        metadata: { reason },
      });
    }
    return updated.count > 0;
  }
}
