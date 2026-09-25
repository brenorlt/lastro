import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import request, { type Response } from 'supertest';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator.js';
import {
  createTestApp,
  DEFAULT_PASSWORD,
  getCookie,
  refreshCookie,
  type TestContext,
  TRUSTED_ORIGIN,
} from './support/test-app.js';

interface ErrorBody {
  success: false;
  code: string;
  message: string;
  statusCode: number;
  details?: { field?: string; message: string }[];
}

interface AuthBody {
  success: true;
  data: { accessToken: string; expiresIn: number; user: Record<string, unknown> };
}

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  let http: Server;

  beforeAll(async () => {
    ctx = await createTestApp({ imports: [DiscoveryModule] });
    http = ctx.http;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  /** Cliente com IP próprio (o rate limit é por IP). */
  const client = () => {
    const ip = ctx.ip();
    return {
      post: (url: string) => request(http).post(url).set('X-Forwarded-For', ip),
      get: (url: string) => request(http).get(url).set('X-Forwarded-For', ip),
      patch: (url: string) => request(http).patch(url).set('X-Forwarded-For', ip),
      delete: (url: string) => request(http).delete(url).set('X-Forwarded-For', ip),
    };
  };

  async function login(email: string, password = DEFAULT_PASSWORD, userAgent = 'jest-e2e') {
    const res = await client()
      .post('/api/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password });
    expect(res.status).toBe(200);
    const body = res.body as AuthBody;
    const rt = getCookie(res, 'lastro_rt');
    if (!rt) throw new Error('cookie lastro_rt ausente');
    return { res, accessToken: body.data.accessToken, refreshToken: rt.value };
  }

  const refresh = (token: string) =>
    client()
      .post('/api/auth/refresh')
      .set('Origin', TRUSTED_ORIGIN)
      .set('Cookie', refreshCookie(token));

  const errorOf = (res: Response) => res.body as ErrorBody;

  function expectCleared(res: Response) {
    for (const name of ['lastro_rt', 'lastro_session']) {
      const cookie = getCookie(res, name);
      expect(cookie?.value).toBe('');
      expect(String(cookie?.attributes.expires)).toContain('1970');
    }
  }

  describe('cadastro, verificação e login', () => {
    const password = 'minhaSenha2026';
    let email: string;

    it('POST /register responde 202 para e-mail novo e para e-mail existente', async () => {
      email = ctx.email('Cadastro').toUpperCase(); // normalização: trim + lowercase
      const first = await client()
        .post('/api/auth/register')
        .send({ name: '  Maria Teste ', email: `  ${email} `, password });
      const second = await client()
        .post('/api/auth/register')
        .send({ name: 'Outra Pessoa', email, password: 'outraSenha2026' });
      email = email.toLowerCase();

      expect(first.status).toBe(202);
      expect(second.status).toBe(202);
      expect(second.body).toEqual(first.body);
      expect(first.body).toEqual({ success: true, data: { message: expect.any(String) } });

      expect(ctx.mail.find(email, 'EMAIL_VERIFICATION')).toHaveLength(1);
      expect(ctx.mail.find(email, 'ACCOUNT_ALREADY_EXISTS')).toHaveLength(1);

      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { email },
        include: { categories: true },
      });
      expect(user.name).toBe('Maria Teste');
      expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(user.categories).toHaveLength(15);
      const tokens = await ctx.prisma.verificationToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenHash).not.toBe(ctx.mail.lastToken(email, 'EMAIL_VERIFICATION'));
    });

    it('rejeita senha fora da política com VALIDATION_ERROR', async () => {
      const res = await client()
        .post('/api/auth/register')
        .send({ name: 'X', email: 'invalido', password: 'semnumeros' });
      expect(res.status).toBe(400);
      const fields = (errorOf(res).details ?? []).map((d) => d.field);
      expect(new Set(fields)).toEqual(new Set(['name', 'email', 'password']));
    });

    it('login antes de verificar → 403 EMAIL_NOT_VERIFIED (só com a senha correta)', async () => {
      const wrong = await client().post('/api/auth/login').send({ email, password: 'errada12345' });
      expect(wrong.status).toBe(401);
      expect(errorOf(wrong).code).toBe('INVALID_CREDENTIALS');

      const res = await client().post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(403);
      expect(errorOf(res).code).toBe('EMAIL_NOT_VERIFIED');
      expect(getCookie(res, 'lastro_rt')).toBeUndefined();
    });

    it('e-mail desconhecido → 401 INVALID_CREDENTIALS com a mesma mensagem', async () => {
      const res = await client()
        .post('/api/auth/login')
        .send({ email: ctx.email('nao-existe'), password });
      expect(res.status).toBe(401);
      expect(errorOf(res)).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha incorretos',
      });
    });

    it('POST /verify-email com o link capturado; o token é de uso único', async () => {
      const token = ctx.mail.lastToken(email, 'EMAIL_VERIFICATION');
      const ok = await client().post('/api/auth/verify-email').send({ token });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ success: true, data: { verified: true } });

      const again = await client().post('/api/auth/verify-email').send({ token });
      expect(again.status).toBe(400);
      expect(errorOf(again)).toMatchObject({
        code: 'TOKEN_INVALID',
        message: 'Link inválido ou expirado',
      });
    });

    it('login → 200 AuthPayload + cookies com as flags corretas', async () => {
      const { res } = await login(email, password);
      const body = res.body as AuthBody;

      expect(body.data.expiresIn).toBe(900);
      expect(body.data.user).toEqual({
        id: expect.any(String),
        name: 'Maria Teste',
        email,
        emailVerified: true,
        avatarUrl: null,
        phone: null,
        currency: 'BRL',
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        theme: 'SYSTEM',
        onboardingCompleted: false,
        notificationPrefs: expect.objectContaining({ channels: { inApp: true, email: true } }),
        createdAt: expect.any(String),
      });

      const rt = getCookie(res, 'lastro_rt');
      expect(rt?.attributes).toMatchObject({
        httponly: true,
        samesite: 'Strict',
        path: '/api/auth',
      });
      expect(rt?.attributes.secure).toBeUndefined(); // NODE_ENV=test
      expect(Number(rt?.attributes['max-age'])).toBeGreaterThan(29 * 86_400);

      const indicator = getCookie(res, 'lastro_session');
      expect(indicator?.value).toBe('1');
      expect(indicator?.attributes).toMatchObject({ samesite: 'Lax', path: '/' });
      expect(indicator?.attributes.httponly).toBeUndefined();
    });

    it('GET /me com bearer', async () => {
      const { accessToken } = await login(email, password);
      const res = await client().get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { email, emailVerified: true } });
    });
  });

  describe('refresh com rotação e detecção de reuso', () => {
    let email: string;

    beforeAll(async () => {
      email = (await ctx.createVerifiedUser('refresh')).email;
    });

    it('rotaciona; reuso do token antigo revoga a família inteira', async () => {
      const first = await login(email);

      const rotated = await refresh(first.refreshToken);
      expect(rotated.status).toBe(200);
      const newToken = getCookie(rotated, 'lastro_rt')?.value ?? '';
      expect(newToken).not.toBe('');
      expect(newToken).not.toBe(first.refreshToken);
      const newAccess = (rotated.body as AuthBody).data.accessToken;

      const reuse = await refresh(first.refreshToken);
      expect(reuse.status).toBe(401);
      expect(errorOf(reuse).code).toBe('SESSION_REVOKED');
      expectCleared(reuse);

      const newest = await refresh(newToken);
      expect(newest.status).toBe(401);
      expect(errorOf(newest).code).toBe('SESSION_REVOKED');

      const me = await client().get('/api/auth/me').set('Authorization', `Bearer ${newAccess}`);
      expect(me.status).toBe(401);
      expect(errorOf(me).code).toBe('SESSION_REVOKED');

      const events = await ctx.prisma.securityEvent.count({
        where: { user: { email }, type: 'REFRESH_REUSE_DETECTED' },
      });
      expect(events).toBe(1);
    });

    it('sem Origin → 403 CSRF_REJECTED; origem estranha também', async () => {
      const { refreshToken } = await login(email);
      const noOrigin = await client()
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie(refreshToken));
      expect(noOrigin.status).toBe(403);
      expect(errorOf(noOrigin).code).toBe('CSRF_REJECTED');

      const evil = await client()
        .post('/api/auth/refresh')
        .set('Origin', 'https://evil.example')
        .set('Cookie', refreshCookie(refreshToken));
      expect(evil.status).toBe(403);

      // Referer confiável serve de fallback quando não há Origin.
      const viaReferer = await client()
        .post('/api/auth/refresh')
        .set('Referer', `${TRUSTED_ORIGIN}/painel`)
        .set('Cookie', refreshCookie(refreshToken));
      expect(viaReferer.status).toBe(200);
    });

    it('sem cookie ou com cookie inválido → 401 UNAUTHORIZED e cookies limpos', async () => {
      const none = await client().post('/api/auth/refresh').set('Origin', TRUSTED_ORIGIN);
      expect(none.status).toBe(401);
      expect(errorOf(none).code).toBe('UNAUTHORIZED');
      expectCleared(none);

      const bogus = await refresh('abc.def');
      expect(errorOf(bogus).code).toBe('UNAUTHORIZED');
    });
  });

  describe('logout', () => {
    it('revoga a sessão, limpa cookies e invalida o access token; é idempotente', async () => {
      const { email } = await ctx.createVerifiedUser('logout');
      const { accessToken, refreshToken } = await login(email);

      const res = await client()
        .post('/api/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', refreshCookie(refreshToken));
      expect(res.status).toBe(204);
      expectCleared(res);

      const me = await client().get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(me.status).toBe(401);
      expect(errorOf(me).code).toBe('SESSION_REVOKED');

      const again = await client().post('/api/auth/logout');
      expect(again.status).toBe(204);
    });

    it('aceita bearer quando não há cookie', async () => {
      const { email } = await ctx.createVerifiedUser('logout-bearer');
      const { accessToken } = await login(email);
      const res = await client()
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(204);
      const me = await client().get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
      expect(me.status).toBe(401);
    });
  });

  describe('bloqueio por força bruta', () => {
    it('após N falhas → 423 ACCOUNT_LOCKED, inclusive com a senha correta', async () => {
      const { email } = await ctx.createVerifiedUser('lockout');
      const c = client();
      for (let i = 1; i <= 4; i++) {
        const res = await c.post('/api/auth/login').send({ email, password: `errada${i}23456` });
        expect(errorOf(res).code).toBe('INVALID_CREDENTIALS');
      }
      const fifth = await c.post('/api/auth/login').send({ email, password: 'errada523456' });
      expect(fifth.status).toBe(423);
      expect(errorOf(fifth).code).toBe('ACCOUNT_LOCKED');
      expect(errorOf(fifth).message).toContain('15 minutos');

      const correct = await c.post('/api/auth/login').send({ email, password: DEFAULT_PASSWORD });
      expect(correct.status).toBe(423);

      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
      expect(user.lockoutCount).toBe(1);
    });
  });

  describe('esqueci / redefinir senha', () => {
    it('fluxo completo revoga todas as sessões', async () => {
      const { email } = await ctx.createVerifiedUser('reset');
      const session = await login(email);

      const unknown = await client()
        .post('/api/auth/forgot-password')
        .send({ email: ctx.email('ninguem') });
      const known = await client().post('/api/auth/forgot-password').send({ email });
      expect(unknown.status).toBe(202);
      expect(known.status).toBe(202);
      expect(known.body).toEqual(unknown.body);
      expect(ctx.mail.find(ctx.email('ninguem'), 'PASSWORD_RESET')).toHaveLength(0);

      const link = ctx.mail.find(email, 'PASSWORD_RESET').at(-1)?.link ?? '';
      expect(link.startsWith(`${TRUSTED_ORIGIN}/redefinir-senha?token=`)).toBe(true);
      const token = ctx.mail.lastToken(email, 'PASSWORD_RESET');

      const bad = await client()
        .post('/api/auth/reset-password')
        .send({ token: 'x'.repeat(43), password: 'novaSenha2026' });
      expect(bad.status).toBe(400);
      expect(errorOf(bad).code).toBe('TOKEN_INVALID');

      const ok = await client()
        .post('/api/auth/reset-password')
        .send({ token, password: 'novaSenha2026' });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ success: true, data: { reset: true } });

      const me = await client()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.accessToken}`);
      expect(me.status).toBe(401);
      expect((await refresh(session.refreshToken)).status).toBe(401);

      const oldPassword = await client()
        .post('/api/auth/login')
        .send({ email, password: DEFAULT_PASSWORD });
      expect(oldPassword.status).toBe(401);
      await login(email, 'novaSenha2026');

      const reuse = await client()
        .post('/api/auth/reset-password')
        .send({ token, password: 'outraSenha2026' });
      expect(reuse.status).toBe(400);

      const changed = await ctx.prisma.securityEvent.count({
        where: { user: { email }, type: 'PASSWORD_CHANGED' },
      });
      expect(changed).toBe(1);
    });

    it('um novo pedido invalida o link anterior', async () => {
      const { email } = await ctx.createVerifiedUser('reset-twice');
      await client().post('/api/auth/forgot-password').send({ email });
      const firstToken = ctx.mail.lastToken(email, 'PASSWORD_RESET');
      await client().post('/api/auth/forgot-password').send({ email });

      const res = await client()
        .post('/api/auth/reset-password')
        .send({ token: firstToken, password: 'novaSenha2026' });
      expect(res.status).toBe(400);
    });
  });

  describe('troca de senha', () => {
    it('senha atual errada → 400 INVALID_PASSWORD; sucesso revoga as outras sessões', async () => {
      const { email } = await ctx.createVerifiedUser('change');
      const current = await login(email, DEFAULT_PASSWORD, 'Atual');
      const other = await login(email, DEFAULT_PASSWORD, 'Outro');
      const auth = { Authorization: `Bearer ${current.accessToken}` };

      const wrong = await client()
        .patch('/api/auth/password')
        .set(auth)
        .send({ currentPassword: 'naoEhEssa123', newPassword: 'trocada2026x' });
      expect(wrong.status).toBe(400);
      expect(errorOf(wrong).code).toBe('INVALID_PASSWORD');
      expect(errorOf(wrong).details).toEqual([
        { field: 'currentPassword', message: 'Senha atual incorreta' },
      ]);

      const ok = await client()
        .patch('/api/auth/password')
        .set(auth)
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'trocada2026x' });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ success: true, data: { changed: true } });

      expect((await client().get('/api/auth/me').set(auth)).status).toBe(200);
      const otherMe = await client()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${other.accessToken}`);
      expect(otherMe.status).toBe(401);
      await login(email, 'trocada2026x');
    });
  });

  describe('sessões', () => {
    it('lista, revoga outra, isola usuários e revoke-others', async () => {
      const { email } = await ctx.createVerifiedUser('sessions');
      const a = await login(email, DEFAULT_PASSWORD, 'Navegador A');
      const b = await login(email, DEFAULT_PASSWORD, 'Navegador B');
      await login(email, DEFAULT_PASSWORD, 'Navegador C');
      const authA = { Authorization: `Bearer ${a.accessToken}` };

      const list = await client().get('/api/auth/sessions').set(authA);
      expect(list.status).toBe(200);
      const sessions = (
        list.body as { data: { id: string; userAgent: string; current: boolean }[] }
      ).data;
      expect(sessions.map((s) => s.userAgent)).toEqual([
        'Navegador C',
        'Navegador B',
        'Navegador A',
      ]);
      expect(sessions.filter((s) => s.current).map((s) => s.userAgent)).toEqual(['Navegador A']);
      expect(Object.keys(sessions[0]).sort()).toEqual(
        ['createdAt', 'current', 'id', 'ip', 'lastUsedAt', 'userAgent'].sort(),
      );
      const sessionB = sessions.find((s) => s.userAgent === 'Navegador B');

      // Sessão de outro usuário → 404.
      const stranger = await ctx.createVerifiedUser('stranger');
      const strangerAuth = await ctx.issueAccessToken(stranger.id);
      const foreign = await client()
        .delete(`/api/auth/sessions/${sessionB?.id}`)
        .set('Authorization', `Bearer ${strangerAuth.accessToken}`);
      expect(foreign.status).toBe(404);
      expect(errorOf(foreign).code).toBe('NOT_FOUND');
      expect((await client().delete('/api/auth/sessions/nao-e-uuid').set(authA)).status).toBe(404);

      const revoke = await client().delete(`/api/auth/sessions/${sessionB?.id}`).set(authA);
      expect(revoke.status).toBe(204);
      const meB = await client()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${b.accessToken}`);
      expect(meB.status).toBe(401);

      const others = await client().post('/api/auth/sessions/revoke-others').set(authA);
      expect(others.status).toBe(200);
      expect(others.body).toEqual({ success: true, data: { revoked: 1 } });

      const after = await client().get('/api/auth/sessions').set(authA);
      expect((after.body as { data: unknown[] }).data).toHaveLength(1);
    });
  });

  describe('rate limiting', () => {
    it('forgot-password: 6ª requisição no minuto → 429 RATE_LIMITED', async () => {
      const c = client();
      const email = ctx.email('throttle');
      for (let i = 0; i < 5; i++) {
        expect((await c.post('/api/auth/forgot-password').send({ email })).status).toBe(202);
      }
      const limited = await c.post('/api/auth/forgot-password').send({ email });
      expect(limited.status).toBe(429);
      expect(errorOf(limited).code).toBe('RATE_LIMITED');
    });
  });

  describe('permissões', () => {
    it('toda rota não-@Public responde 401 UNAUTHORIZED sem token', async () => {
      const discovery = ctx.app.get(DiscoveryService);
      const scanner = ctx.app.get(MetadataScanner);
      const reflector = ctx.app.get(Reflector);
      const routes: { method: string; path: string }[] = [];

      for (const wrapper of discovery.getControllers()) {
        const instance = wrapper.instance as object | undefined;
        if (!instance || !wrapper.metatype) continue;
        const controllerPath = String(Reflect.getMetadata(PATH_METADATA, wrapper.metatype) ?? '');
        const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;

        for (const name of scanner.getAllMethodNames(prototype)) {
          const handler = prototype[name];
          if (typeof handler !== 'function') continue;
          const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
          if (methodPath === undefined) continue;
          const isPublic = reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
            handler,
            wrapper.metatype,
          ]);
          if (isPublic) continue;
          const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
          const path = `/api/${controllerPath}/${methodPath}`
            .replace(/\/+/g, '/')
            .replace(/\/$/, '')
            .replace(/:[^/]+/g, '00000000-0000-4000-8000-000000000000');
          routes.push({ method: method.toLowerCase(), path });
        }
      }

      expect(routes.length).toBeGreaterThanOrEqual(5);
      for (const route of routes) {
        const res = await request(http)[route.method as 'get'](route.path);
        expect({ ...route, status: res.status, code: errorOf(res).code }).toEqual({
          ...route,
          status: 401,
          code: 'UNAUTHORIZED',
        });
      }
    });
  });
});
