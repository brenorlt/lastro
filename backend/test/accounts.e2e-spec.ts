import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type AuthedClient, type ErrorBody, quickUser } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface AccountBody {
  id: string;
  name: string;
  type: string;
  status: string;
  initialBalance: string;
  currentBalance: string;
  includeInNetWorth: boolean;
}

const base = { type: 'CHECKING', color: '#8B5CF6', icon: 'wallet' };

describe('Accounts (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let userId: string;

  const create = (body: Record<string, unknown>) =>
    client.post('/api/accounts').send({ ...base, ...body });
  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;

  beforeAll(async () => {
    ctx = await createTestApp();
    const owner = await quickUser(ctx, 'accounts');
    client = owner.client;
    userId = owner.user.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('CRUD básico com dinheiro em string', async () => {
    const created = await create({
      name: 'Nubank',
      institution: 'Nu',
      initialBalance: '1520.4',
    }).expect(201);
    const account = data<AccountBody>(created);
    expect(account).toMatchObject({
      name: 'Nubank',
      initialBalance: '1520.40',
      currentBalance: '1520.40',
      status: 'ACTIVE',
      includeInNetWorth: true,
    });

    expect(
      data<AccountBody>(await client.get(`/api/accounts/${account.id}`).expect(200)).name,
    ).toBe('Nubank');

    // Simula lançamentos já aplicados: currentBalance ≠ initialBalance.
    await ctx.prisma.account.update({
      where: { id: account.id },
      data: { currentBalance: '1600.40' },
    });
    const patched = await client
      .patch(`/api/accounts/${account.id}`)
      .send({ initialBalance: '1500.00', name: 'Nubank PF' })
      .expect(200);
    expect(data<AccountBody>(patched)).toMatchObject({
      name: 'Nubank PF',
      initialBalance: '1500.00',
      currentBalance: '1580.00', // 1600.40 + (1500.00 − 1520.40)
    });

    const invalid = await client
      .patch(`/api/accounts/${account.id}`)
      .send({ initialBalance: 10 })
      .expect(400);
    expect((invalid.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    await client.patch(`/api/accounts/${account.id}`).send({ name: null }).expect(400);

    await client.delete(`/api/accounts/${account.id}`).expect(204);
    const gone = await client.get(`/api/accounts/${account.id}`).expect(404);
    expect((gone.body as ErrorBody).code).toBe('ACCOUNT_NOT_FOUND');
    const list = await client.get('/api/accounts?status=ALL').expect(200);
    expect(data<AccountBody[]>(list).some((a) => a.id === account.id)).toBe(false);

    // Conta excluída não bloqueia o nome.
    await create({ name: 'nubank pf', initialBalance: '0' }).expect(201);
  });

  it('meta soma decimais exatos só de ativas com includeInNetWorth', async () => {
    const { client: c } = await quickUser(ctx, 'accounts-meta');
    const make = (body: Record<string, unknown>) =>
      c.post('/api/accounts').send({ ...base, ...body });
    await make({ name: 'A', initialBalance: '0.10' }).expect(201);
    await make({ name: 'B', initialBalance: '0.20' }).expect(201);
    await make({ name: 'Invest', type: 'INVESTMENT', initialBalance: '-5.05' }).expect(201);
    await make({ name: 'Fora', initialBalance: '100.00', includeInNetWorth: false }).expect(201);
    const archived = data<AccountBody>(
      await make({ name: 'Velha', initialBalance: '50.00' }).expect(201),
    );
    await c.post(`/api/accounts/${archived.id}/archive`).expect(200);

    const res = await c.get('/api/accounts').expect(200);
    const body = res.body as {
      data: AccountBody[];
      meta: { totalBalance: string; count: number; byType: Record<string, string> };
    };
    expect(body.meta).toEqual({
      totalBalance: '-4.75',
      count: 4,
      byType: { CHECKING: '0.30', INVESTMENT: '-5.05' },
    });
    expect(body.data.map((a) => a.name)).toEqual(['A', 'B', 'Invest', 'Fora']);

    const all = await c.get('/api/accounts?status=ALL').expect(200);
    expect(data<AccountBody[]>(all).map((a) => a.status)).toEqual([
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'ACTIVE',
      'ARCHIVED',
    ]);
    expect(
      data<AccountBody[]>(await c.get('/api/accounts?status=ARCHIVED').expect(200)),
    ).toHaveLength(1);
    await c.get('/api/accounts?status=DELETED').expect(400);
  });

  it('nome duplicado (case-insensitive) entre ativas → 409; arquivar/desarquivar', async () => {
    const first = data<AccountBody>(
      await create({ name: 'Carteira', initialBalance: '0' }).expect(201),
    );
    const dup = await create({ name: 'CARTEIRA', initialBalance: '0' }).expect(409);
    expect((dup.body as ErrorBody).code).toBe('ACCOUNT_NAME_TAKEN');

    const archived = await client.post(`/api/accounts/${first.id}/archive`).expect(200);
    expect(data<AccountBody>(archived).status).toBe('ARCHIVED');
    // Arquivada não bloqueia; ainda pode ser editada.
    const second = data<AccountBody>(
      await create({ name: 'carteira', initialBalance: '0' }).expect(201),
    );
    await client.patch(`/api/accounts/${first.id}`).send({ color: '#000000' }).expect(200);

    const conflict = await client.post(`/api/accounts/${first.id}/unarchive`).expect(409);
    expect((conflict.body as ErrorBody).code).toBe('ACCOUNT_NAME_TAKEN');
    await client.patch(`/api/accounts/${second.id}`).send({ name: 'Carteira 2' }).expect(200);
    const unarchived = await client.post(`/api/accounts/${first.id}/unarchive`).expect(200);
    expect(data<AccountBody>(unarchived).status).toBe('ACTIVE');
  });

  it('conta de outro usuário → 404 ACCOUNT_NOT_FOUND em todas as operações', async () => {
    const mine = data<AccountBody>(
      await create({ name: 'Privada', initialBalance: '1.00' }).expect(201),
    );
    const { client: other } = await quickUser(ctx, 'accounts-intruder');
    for (const res of [
      await other.get(`/api/accounts/${mine.id}`),
      await other.patch(`/api/accounts/${mine.id}`).send({ name: 'Hack' }),
      await other.post(`/api/accounts/${mine.id}/archive`),
      await other.delete(`/api/accounts/${mine.id}`),
      await other.get('/api/accounts/nao-e-uuid'),
    ]) {
      expect(res.status).toBe(404);
      expect((res.body as ErrorBody).code).toBe('ACCOUNT_NOT_FOUND');
    }
    expect(data<AccountBody[]>(await other.get('/api/accounts?status=ALL'))).toEqual([]);
  });

  it('exclusão com lançamentos → 409 ACCOUNT_IN_USE com detalhes', async () => {
    const account = data<AccountBody>(
      await create({ name: 'Movimentada', initialBalance: '0' }).expect(201),
    );
    await ctx.prisma.transaction.createMany({
      data: [1, 2].map((n) => ({
        userId,
        accountId: account.id,
        type: 'EXPENSE' as const,
        amount: '10.00',
        description: `Compra ${n}`,
        date: new Date(),
      })),
    });
    const res = await client.delete(`/api/accounts/${account.id}`).expect(409);
    const error = res.body as ErrorBody;
    expect(error.code).toBe('ACCOUNT_IN_USE');
    expect(error.details).toEqual([{ field: 'transactions', message: '2 lançamentos vinculados' }]);

    // Lançamentos excluídos (soft) não bloqueiam.
    await ctx.prisma.transaction.updateMany({
      where: { accountId: account.id },
      data: { deletedAt: new Date() },
    });
    await client.delete(`/api/accounts/${account.id}`).expect(204);
  });
});
