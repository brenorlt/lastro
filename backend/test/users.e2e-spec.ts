import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import {
  createTestApp,
  DEFAULT_PASSWORD,
  getCookie,
  type TestContext,
} from './support/test-app.js';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

interface UserBody {
  data: {
    name: string;
    phone: string | null;
    currency: string;
    timezone: string;
    theme: string;
    avatarUrl: string | null;
    notificationPrefs: Record<string, unknown> & { channels: Record<string, boolean> };
  };
}

describe('Users (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('perfil', () => {
    it('GET /users/me traz notificationPrefs completo; /auth/me usa o mesmo DTO', async () => {
      const { client } = await quickUser(ctx, 'perfil');
      const me = await client.get('/api/users/me').expect(200);
      const authMe = await client.get('/api/auth/me').expect(200);
      expect(authMe.body).toEqual(me.body);
      expect((me.body as UserBody).data.notificationPrefs).toEqual({
        channels: { inApp: true, email: true },
        billsDue: true,
        invoiceDue: true,
        budgetAlerts: true,
        goalReminders: true,
        emergencyFund: true,
        newTransactions: false,
        recurring: true,
        weeklySummary: false,
      });
    });

    it('PATCH /users/me atualiza campos e mescla notificationPrefs', async () => {
      const { client } = await quickUser(ctx, 'patch');
      const res = await client
        .patch('/api/users/me')
        .send({
          name: '  Novo Nome ',
          phone: '+55 11 91234-5678',
          currency: 'USD',
          locale: 'en-US',
          timezone: 'Europe/Lisbon',
          theme: 'DARK',
          notificationPrefs: { weeklySummary: true, channels: { email: false } },
        })
        .expect(200);
      const data = (res.body as UserBody).data;
      expect(data).toMatchObject({
        name: 'Novo Nome',
        phone: '+55 11 91234-5678',
        currency: 'USD',
        timezone: 'Europe/Lisbon',
        theme: 'DARK',
      });
      expect(data.notificationPrefs.channels).toEqual({ inApp: true, email: false });
      expect(data.notificationPrefs.weeklySummary).toBe(true);

      const second = await client
        .patch('/api/users/me')
        .send({ phone: null, notificationPrefs: { channels: { inApp: false } } })
        .expect(200);
      const after = (second.body as UserBody).data;
      expect(after.phone).toBeNull();
      expect(after.notificationPrefs.channels).toEqual({ inApp: false, email: false });
      expect(after.notificationPrefs.weeklySummary).toBe(true);
    });

    it.each([
      [{ timezone: 'Marte/Olympus' }, 'timezone'],
      [{ currency: 'BTC' }, 'currency'],
      [{ name: null }, 'name'],
      [{ email: 'novo@x.com' }, 'email'],
      [{ notificationPrefs: { billsDue: 'sim' } }, 'notificationPrefs.billsDue'],
      [{ notificationPrefs: { channels: { sms: true } } }, 'notificationPrefs.channels.sms'],
    ])('PATCH inválido %p → VALIDATION_ERROR em %s', async (body, field) => {
      const { client } = await quickUser(ctx, `invalid-${field}`);
      const res = await client.patch('/api/users/me').send(body).expect(400);
      const error = res.body as ErrorBody;
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((d) => d.field)).toContain(field);
    });
  });

  describe('avatar', () => {
    it('upload PNG, serve publicamente, troca remove o anterior, DELETE limpa', async () => {
      const { client } = await quickUser(ctx, 'avatar');
      const up = await client
        .post('/api/users/me/avatar')
        .attach('file', PNG_1PX, { filename: 'eu.png', contentType: 'image/png' })
        .expect(200);
      const url = (up.body as UserBody).data.avatarUrl ?? '';
      expect(url).toMatch(/^\/api\/users\/avatars\/[a-f0-9]{32}\.png$/);

      const served = await request(ctx.http).get(url).expect(200);
      expect(served.headers['content-type']).toBe('image/png');
      expect(served.headers['x-content-type-options']).toBe('nosniff');
      expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(Buffer.compare(served.body as Buffer, PNG_1PX)).toBe(0);

      const replaced = await client
        .post('/api/users/me/avatar')
        .attach('file', PNG_1PX, { filename: 'outra.png', contentType: 'image/png' })
        .expect(200);
      expect((replaced.body as UserBody).data.avatarUrl).not.toBe(url);
      await request(ctx.http).get(url).expect(404);

      const removed = await client.delete('/api/users/me/avatar').expect(200);
      expect((removed.body as UserBody).data.avatarUrl).toBeNull();
      await request(ctx.http)
        .get((replaced.body as UserBody).data.avatarUrl ?? '')
        .expect(404);
    });

    it('texto renomeado para .png → 400 INVALID_FILE_TYPE', async () => {
      const { client } = await quickUser(ctx, 'fake-png');
      const res = await client
        .post('/api/users/me/avatar')
        .attach('file', Buffer.from('não sou uma imagem'), {
          filename: 'foto.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('INVALID_FILE_TYPE');
    });

    it('arquivo > 2 MB → 413 FILE_TOO_LARGE', async () => {
      const { client } = await quickUser(ctx, 'big');
      const big = Buffer.concat([PNG_1PX, Buffer.alloc(2 * 1024 * 1024)]);
      const res = await client
        .post('/api/users/me/avatar')
        .attach('file', big, { filename: 'grande.png', contentType: 'image/png' })
        .expect(413);
      expect((res.body as ErrorBody).code).toBe('FILE_TOO_LARGE');
    });

    it('sem arquivo → 400 VALIDATION_ERROR', async () => {
      const { client } = await quickUser(ctx, 'nofile');
      const res = await client.post('/api/users/me/avatar').expect(400);
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it.each([
      '/api/users/avatars/..%2F..%2F.env',
      '/api/users/avatars/%2e%2e%2fpackage.json',
      '/api/users/avatars/0123456789abcdef0123456789abcdef.svg',
      '/api/users/avatars/0123456789abcdef0123456789abcdef.png',
      '/api/users/avatars/..',
    ])('GET %s → 404', async (url) => {
      const res = await request(ctx.http).get(url);
      expect(res.status).toBe(404);
    });
  });

  describe('exclusão de conta', () => {
    it('senha errada → 400 INVALID_PASSWORD; confirmação errada → 400 VALIDATION_ERROR', async () => {
      const { client } = await quickUser(ctx, 'del-guard');
      const wrongPassword = await client
        .delete('/api/users/me')
        .send({ password: 'naoEhEssa123', confirmation: 'EXCLUIR' })
        .expect(400);
      expect((wrongPassword.body as ErrorBody).code).toBe('INVALID_PASSWORD');
      expect((wrongPassword.body as ErrorBody).details?.[0].field).toBe('password');

      const wrongConfirmation = await client
        .delete('/api/users/me')
        .send({ password: DEFAULT_PASSWORD, confirmation: 'excluir' })
        .expect(400);
      expect((wrongConfirmation.body as ErrorBody).code).toBe('VALIDATION_ERROR');
      expect((wrongConfirmation.body as ErrorBody).details?.[0].field).toBe('confirmation');
    });

    it('sucesso: 204, cascade, cookies limpos, evento anônimo e sessão inválida', async () => {
      const session = await registerAndLogin(ctx, 'del-ok');
      await session.client
        .post('/api/accounts')
        .send({
          name: 'Conta',
          type: 'CHECKING',
          initialBalance: '10.00',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201);
      await session.client
        .post('/api/users/me/avatar')
        .attach('file', PNG_1PX, { filename: 'a.png', contentType: 'image/png' })
        .expect(200);
      const avatarUrl = ((await session.client.get('/api/users/me')).body as UserBody).data
        .avatarUrl;

      const res = await session.client
        .delete('/api/users/me')
        .send({ password: DEFAULT_PASSWORD, confirmation: 'EXCLUIR' })
        .expect(204);
      for (const name of ['lastro_rt', 'lastro_session']) {
        expect(getCookie(res, name)?.value).toBe('');
      }

      expect(await ctx.prisma.user.count({ where: { id: session.userId } })).toBe(0);
      expect(await ctx.prisma.account.count({ where: { userId: session.userId } })).toBe(0);
      expect(await ctx.prisma.category.count({ where: { userId: session.userId } })).toBe(0);
      await request(ctx.http)
        .get(avatarUrl ?? '')
        .expect(404);

      const me = await session.client.get('/api/auth/me').expect(401);
      expect((me.body as ErrorBody).statusCode).toBe(401);

      const { createHash } = await import('node:crypto');
      const emailHash = createHash('sha256').update(session.email).digest('hex');
      const event = await ctx.prisma.securityEvent.findFirst({
        where: { type: 'ACCOUNT_DELETED', metadata: { path: ['emailHash'], equals: emailHash } },
      });
      expect(event?.userId).toBeNull();
      if (event) await ctx.prisma.securityEvent.delete({ where: { id: event.id } });
    });
  });
});
