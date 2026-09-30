import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request, { type Response } from 'supertest';
import { OAUTH_STATE_COOKIE } from '../src/auth/oauth/google-auth.controller.js';
import {
  type GoogleProfile,
  GoogleOAuthService,
  type OAuthFlowState,
} from '../src/auth/oauth/google-oauth.service.js';
import {
  createTestApp,
  DEFAULT_PASSWORD,
  getCookie,
  refreshCookie,
  type TestContext,
  TRUSTED_ORIGIN,
} from './support/test-app.js';

describe('Login com Google (e2e)', () => {
  let ctx: TestContext;
  let http: Server;
  let google: GoogleOAuthService;
  let exchange: jest.SpiedFunction<GoogleOAuthService['exchangeCode']>;
  let nextProfile: GoogleProfile;
  let subCounter = 0;

  beforeAll(async () => {
    ctx = await createTestApp();
    http = ctx.http;
    google = ctx.app.get(GoogleOAuthService);
    exchange = jest
      .spyOn(google, 'exchangeCode')
      .mockImplementation(() => Promise.resolve(nextProfile));
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(() => {
    exchange.mockClear();
  });

  const profileFor = (label: string, overrides: Partial<GoogleProfile> = {}): GoogleProfile => {
    subCounter += 1;
    return {
      sub: `${ctx.emailPrefix}${subCounter}`,
      email: ctx.email(label),
      emailVerified: true,
      name: `Google ${label}`,
      picture: 'https://lh3.googleusercontent.com/a/foto',
      ...overrides,
    };
  };

  /** /auth/google → devolve o cookie do fluxo e o `state` enviado ao Google. */
  async function start(next?: string) {
    const ip = ctx.ip();
    const res = await request(http)
      .get('/api/auth/google')
      .query(next ? { next } : {})
      .set('X-Forwarded-For', ip);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    const cookie = getCookie(res, OAUTH_STATE_COOKIE);
    expect(cookie).toBeDefined();
    return { ip, location, cookie: cookie!, state: location.searchParams.get('state')! };
  }

  async function signIn(profile: GoogleProfile, next?: string): Promise<Response> {
    nextProfile = profile;
    const flow = await start(next);
    return request(http)
      .get('/api/auth/google/callback')
      .query({ code: 'codigo', state: flow.state })
      .set('X-Forwarded-For', flow.ip)
      .set('Cookie', `${OAUTH_STATE_COOKIE}=${encodeURIComponent(flow.cookie.value)}`);
  }

  const redirectPath = (res: Response) => {
    const url = new URL(res.headers.location);
    return `${url.pathname}${url.search}`;
  };

  it('redireciona para o Google com PKCE, nonce e cookie de estado Lax/httpOnly', async () => {
    const { location, cookie } = await start();
    expect(location.origin + location.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    const params = location.searchParams;
    expect(params.get('redirect_uri')).toBe(`${TRUSTED_ORIGIN}/api/auth/google/callback`);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('nonce')).toBeTruthy();
    expect(cookie.attributes).toMatchObject({
      httponly: true,
      samesite: 'Lax',
      path: '/api/auth/google',
    });
  });

  it('cria usuário novo verificado, sem senha, com sessão e onboarding', async () => {
    const profile = profileFor('novo');
    const res = await signIn(profile);
    expect(res.status).toBe(302);
    expect(redirectPath(res)).toBe('/onboarding');
    expect(getCookie(res, 'lastro_rt')?.value).toBeTruthy();
    expect(getCookie(res, 'lastro_session')?.value).toBe('1');

    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: profile.email },
      include: { oauthIdentities: true, subscription: true, categories: true },
    });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.avatarUrl).toBe(profile.picture);
    expect(user.oauthIdentities).toMatchObject([
      { provider: 'GOOGLE', providerUserId: profile.sub },
    ]);
    expect(user.subscription?.trialEndsAt).toBeTruthy();
    expect(user.categories.length).toBeGreaterThan(0);

    // A sessão emitida funciona no /refresh normal.
    const refreshed = await request(http)
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('X-Forwarded-For', ctx.ip())
      .set('Cookie', refreshCookie(getCookie(res, 'lastro_rt')!.value));
    expect(refreshed.status).toBe(200);

    // Sem senha: login por senha falha como credencial inválida.
    const login = await request(http)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ctx.ip())
      .send({ email: profile.email, password: DEFAULT_PASSWORD });
    expect(login.status).toBe(401);
    expect((login.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
  });

  it('segundo login reusa a identidade (mesmo sub) e respeita ?next= após onboarding', async () => {
    const profile = profileFor('recorrente');
    await signIn(profile);
    await ctx.prisma.user.update({
      where: { email: profile.email },
      data: { onboardingCompletedAt: new Date() },
    });

    const res = await signIn(
      { ...profile, email: ctx.email('recorrente-novo-email') },
      '/metas?x=1',
    );
    expect(redirectPath(res)).toBe('/metas?x=1');
    expect(
      await ctx.prisma.user.count({ where: { email: ctx.email('recorrente-novo-email') } }),
    ).toBe(0);
  });

  it('ignora ?next= externo', async () => {
    const profile = profileFor('next-externo');
    await signIn(profile);
    await ctx.prisma.user.update({
      where: { email: profile.email },
      data: { onboardingCompletedAt: new Date() },
    });
    const res = await signIn(profile, '//evil.com/roubo');
    expect(redirectPath(res)).toBe('/painel');
  });

  it('vincula conta local verificada mantendo a senha', async () => {
    const user = await ctx.createVerifiedUser('local-verificada');
    const res = await signIn(profileFor('local-verificada'));
    expect(res.status).toBe(302);
    expect(getCookie(res, 'lastro_rt')?.value).toBeTruthy();

    const after = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { oauthIdentities: true },
    });
    expect(after.passwordHash).toBe(user.passwordHash);
    expect(after.oauthIdentities).toHaveLength(1);
  });

  it('conta local NÃO verificada: descarta a senha e as sessões antes de vincular', async () => {
    const user = await ctx.createVerifiedUser('local-pendente');
    await ctx.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });
    const { sessionId } = await ctx.issueAccessToken(user.id);

    await signIn(profileFor('local-pendente'));

    const after = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).toBeNull();
    expect(after.emailVerifiedAt).not.toBeNull();
    const old = await ctx.prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(old.revokedAt).not.toBeNull();
  });

  it('recusa e-mail não verificado pelo Google', async () => {
    const profile = profileFor('nao-verificado', { emailVerified: false });
    const res = await signIn(profile);
    expect(redirectPath(res)).toBe('/entrar?erro=google_email_nao_verificado');
    expect(getCookie(res, 'lastro_rt')).toBeUndefined();
    expect(await ctx.prisma.user.count({ where: { email: profile.email } })).toBe(0);
  });

  it('recusa state divergente ou cookie ausente sem chamar o Google', async () => {
    const flow = await start();
    const mismatch = await request(http)
      .get('/api/auth/google/callback')
      .query({ code: 'codigo', state: 'outro-state' })
      .set('Cookie', `${OAUTH_STATE_COOKIE}=${encodeURIComponent(flow.cookie.value)}`);
    expect(redirectPath(mismatch)).toBe('/entrar?erro=google_falhou');

    const noCookie = await request(http)
      .get('/api/auth/google/callback')
      .query({ code: 'codigo', state: flow.state });
    expect(redirectPath(noCookie)).toBe('/entrar?erro=google_falhou');
    expect(exchange).not.toHaveBeenCalled();
  });

  it('cancelamento na tela do Google volta para /entrar', async () => {
    const res = await request(http)
      .get('/api/auth/google/callback')
      .query({ error: 'access_denied' });
    expect(redirectPath(res)).toBe('/entrar?erro=google_cancelado');
  });

  it('o cookie de estado carrega nonce/verifier assinados, não adulteráveis', async () => {
    const { cookie, state } = await start();
    const [header, , signature] = cookie.value.split('.');
    const forged: OAuthFlowState = { state, nonce: 'n', codeVerifier: 'v', next: null };
    const tampered = `${header}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;
    const res = await request(http)
      .get('/api/auth/google/callback')
      .query({ code: 'codigo', state })
      .set('Cookie', `${OAUTH_STATE_COOKIE}=${encodeURIComponent(tampered)}`);
    expect(redirectPath(res)).toBe('/entrar?erro=google_falhou');
  });
});
