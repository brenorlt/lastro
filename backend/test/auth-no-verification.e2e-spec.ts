import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { TestContext } from './support/test-app.js';

const DEFAULT_PASSWORD = 'senhaForte2026';

describe('Auth sem confirmação de e-mail obrigatória (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // O ConfigModule lê o ambiente ao ser importado: definir antes do import dinâmico.
    // O setup-env restaura 'true' para as demais suítes.
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'false';
    const { createTestApp } = await import('./support/test-app.js');
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('cadastro seguido de login entra direto, com emailVerified=false', async () => {
    const ip = ctx.ip();
    const email = ctx.email('sem-verificacao');

    const reg = await request(ctx.http)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ name: 'Sem Verificação', email, password: DEFAULT_PASSWORD });
    expect(reg.status).toBe(202);

    const res = await request(ctx.http)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    const body = res.body as { data: { accessToken: string; user: { emailVerified: boolean } } };
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.user.emailVerified).toBe(false);
  });

  it('senha errada continua genérica', async () => {
    const email = ctx.email('sem-verificacao-2');
    await ctx.createVerifiedUser('sem-verificacao-2');
    const res = await request(ctx.http)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ctx.ip())
      .send({ email, password: 'outraSenha2026' });
    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
  });
});
