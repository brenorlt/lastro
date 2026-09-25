import type { Server } from 'node:http';
import request from 'supertest';
import { DEFAULT_PASSWORD, getCookie, type TestContext } from './test-app.js';

export interface ErrorBody {
  success: false;
  code: string;
  message: string;
  statusCode: number;
  details?: { field?: string; message: string }[];
}

/** Cliente autenticado (bearer) com IP próprio. */
export function authed(http: Server, accessToken: string, ip: string) {
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${accessToken}`).set('X-Forwarded-For', ip);
  return {
    get: (url: string) => auth(request(http).get(url)),
    post: (url: string) => auth(request(http).post(url)),
    patch: (url: string) => auth(request(http).patch(url)),
    put: (url: string) => auth(request(http).put(url)),
    delete: (url: string) => auth(request(http).delete(url)),
  };
}

export type AuthedClient = ReturnType<typeof authed>;

/** Cadastro real via API (inclui categorias padrão), verificação e login. */
export async function registerAndLogin(ctx: TestContext, label: string) {
  const ip = ctx.ip();
  const email = ctx.email(label);
  await request(ctx.http)
    .post('/api/auth/register')
    .set('X-Forwarded-For', ip)
    .send({ name: `Teste ${label}`, email, password: DEFAULT_PASSWORD })
    .expect(202);
  await request(ctx.http)
    .post('/api/auth/verify-email')
    .set('X-Forwarded-For', ip)
    .send({ token: ctx.mail.lastToken(email, 'EMAIL_VERIFICATION') })
    .expect(200);
  const res = await request(ctx.http)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ email, password: DEFAULT_PASSWORD })
    .expect(200);
  const body = res.body as { data: { accessToken: string; user: { id: string } } };
  return {
    email,
    userId: body.data.user.id,
    accessToken: body.data.accessToken,
    refreshToken: getCookie(res, 'lastro_rt')?.value ?? '',
    client: authed(ctx.http, body.data.accessToken, ctx.ip()),
  };
}

/** Usuário verificado criado direto no banco (sem categorias) + cliente autenticado. */
export async function quickUser(ctx: TestContext, label: string) {
  const user = await ctx.createVerifiedUser(label);
  const { accessToken } = await ctx.issueAccessToken(user.id);
  return { user, client: authed(ctx.http, accessToken, ctx.ip()) };
}
