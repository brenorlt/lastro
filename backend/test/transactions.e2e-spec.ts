import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addDays, addMonthsClamped, todayIn } from '../src/common/utils/date-only.js';
import { expectedBalance } from '../src/modules/transactions/balance.js';
import { RecurrenceService } from '../src/modules/transactions/recurrence.service.js';
import { installmentDates, recurrenceDates } from '../src/modules/transactions/schedule.js';
import { type ErrorBody, quickUser } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface Tx {
  id: string;
  type: string;
  amount: string;
  description: string;
  date: string;
  status: 'CLEARED' | 'PENDING';
  notes: string | null;
  account: { id: string } | null;
  transferAccount: { id: string } | null;
  category: { id: string; parentId: string | null } | null;
  tags: { id: string; name: string }[];
  installment: { groupId: string; number: number; total: number } | null;
  recurring: { id: string; active: boolean; endDate: string | null } | null;
}

interface ListBody {
  data: Tx[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    totals: Record<string, string>;
  };
}

const TODAY = todayIn('America/Sao_Paulo');

describe('Transactions (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const error = (res: { body: unknown }) => res.body as ErrorBody;

  async function setup(label: string) {
    const { user, client } = await quickUser(ctx, label);
    const account = async (name: string, initialBalance = '0.00') =>
      data<{ id: string }>(
        await client
          .post('/api/accounts')
          .send({ name, type: 'CHECKING', initialBalance, color: '#111111', icon: 'wallet' })
          .expect(201),
      ).id;
    const category = async (name: string, type: 'INCOME' | 'EXPENSE', parentId?: string) =>
      data<{ id: string }>(
        await client
          .post('/api/categories')
          .send({ name, type, icon: 'tag', color: '#222222', parentId })
          .expect(201),
      ).id;
    const balance = async (id: string) =>
      data<{ currentBalance: string }>(await client.get(`/api/accounts/${id}`).expect(200))
        .currentBalance;
    const create = (body: Record<string, unknown>) => client.post('/api/transactions').send(body);
    return { user, client, account, category, balance, create };
  }

  /** Verifica a invariante de saldo de todas as contas do usuário direto no banco. */
  async function assertInvariant(userId: string) {
    const accounts = await ctx.prisma.account.findMany({ where: { userId } });
    const transactions = await ctx.prisma.transaction.findMany({ where: { userId } });
    for (const account of accounts) {
      expect({
        account: account.name,
        balance: account.currentBalance.toFixed(2),
      }).toEqual({
        account: account.name,
        balance: expectedBalance(account.id, account.initialBalance, transactions).toFixed(2),
      });
    }
  }

  describe('saldo e status', () => {
    let s: Awaited<ReturnType<typeof setup>>;
    let acc: string;

    beforeAll(async () => {
      s = await setup('tx-balance');
      acc = await s.account('Principal', '100.00');
    });

    it('receita e despesa movem o saldo; data futura vira PENDING e não mexe no saldo', async () => {
      await s
        .create({
          type: 'INCOME',
          amount: '50.25',
          description: 'Freela',
          date: TODAY,
          accountId: acc,
        })
        .expect(201);
      const [expense] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '20.10',
            description: 'Almoço',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      expect(expense).toMatchObject({
        status: 'CLEARED',
        date: TODAY,
        amount: '20.10',
        category: null,
      });
      expect(await s.balance(acc)).toBe('130.15');

      const [future] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '99.00',
            description: 'Agendado',
            date: addDays(TODAY, 5),
            accountId: acc,
          })
          .expect(201),
      );
      expect(future.status).toBe('PENDING');
      expect(await s.balance(acc)).toBe('130.15');

      // Pago adiantado: confirmar um agendado vale e já move o saldo.
      const confirmFuture = await s.client
        .post(`/api/transactions/${future.id}/confirm`)
        .expect(200);
      expect(data<Tx>(confirmFuture).status).toBe('CLEARED');
      expect(await s.balance(acc)).toBe('31.15');
    });

    it('CLEARED com data futura é aceito e move o saldo', async () => {
      const before = await s.balance(acc);
      const [paid] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '1.00',
            description: 'X',
            date: addDays(TODAY, 1),
            status: 'CLEARED',
            accountId: acc,
          })
          .expect(201),
      );
      expect(paid.status).toBe('CLEARED');
      expect(await s.balance(acc)).toBe((Number(before) - 1).toFixed(2));
    });

    it('confirm/unconfirm movem o saldo', async () => {
      const [pending] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '30.00',
            description: 'Boleto',
            date: addDays(TODAY, -2),
            status: 'PENDING',
            accountId: acc,
          })
          .expect(201),
      );
      const before = await s.balance(acc);
      expect(
        data<Tx>(await s.client.post(`/api/transactions/${pending.id}/confirm`).expect(200)).status,
      ).toBe('CLEARED');
      expect(await s.balance(acc)).toBe((Number(before) - 30).toFixed(2));
      await s.client.post(`/api/transactions/${pending.id}/confirm`).expect(200); // idempotente
      expect(await s.balance(acc)).toBe((Number(before) - 30).toFixed(2));
      await s.client.post(`/api/transactions/${pending.id}/unconfirm`).expect(200);
      expect(await s.balance(acc)).toBe(before);
      await assertInvariant(s.user.id);
    });

    it('transferência move as duas contas; mesma conta e conta arquivada → 400', async () => {
      const savings = await s.account('Poupança', '0.00');
      const before = await s.balance(acc);
      const transfer = data<Tx>(
        await s.client
          .post('/api/transactions/transfers')
          .send({ fromAccountId: acc, toAccountId: savings, amount: '40.00', date: TODAY })
          .expect(201),
      );
      expect(transfer).toMatchObject({
        type: 'TRANSFER',
        description: 'Transferência',
        category: null,
      });
      expect(transfer.transferAccount?.id).toBe(savings);
      expect(await s.balance(acc)).toBe((Number(before) - 40).toFixed(2));
      expect(await s.balance(savings)).toBe('40.00');

      const same = await s.client
        .post('/api/transactions/transfers')
        .send({ fromAccountId: acc, toAccountId: acc, amount: '1.00', date: TODAY })
        .expect(400);
      expect(error(same).code).toBe('SAME_ACCOUNT_TRANSFER');

      await s.client.post(`/api/accounts/${savings}/archive`).expect(200);
      const archived = await s
        .create({
          type: 'INCOME',
          amount: '1.00',
          description: 'X',
          date: TODAY,
          accountId: savings,
        })
        .expect(400);
      expect(error(archived).code).toBe('ACCOUNT_ARCHIVED');
      await s.client
        .post('/api/transactions/transfers')
        .send({ fromAccountId: acc, toAccountId: savings, amount: '1.00', date: TODAY })
        .expect(400);
      // Lançamento existente em conta arquivada continua editável.
      await s.client
        .patch(`/api/transactions/${transfer.id}`)
        .send({ description: 'Reserva' })
        .expect(200);

      const detail = data<{ stats: { transactionCount: number; lastTransactionDate: string } }>(
        await s.client.get(`/api/accounts/${savings}`).expect(200),
      );
      expect(detail.stats).toEqual({ transactionCount: 1, lastTransactionDate: TODAY });
      // Destino de transferência também bloqueia a exclusão da conta.
      await s.client.post(`/api/accounts/${savings}/unarchive`).expect(200);
      expect(error(await s.client.delete(`/api/accounts/${savings}`).expect(409)).code).toBe(
        'ACCOUNT_IN_USE',
      );
      await assertInvariant(s.user.id);
    });

    it('categoria de tipo diferente → 400; categoria/conta de outro usuário → 404', async () => {
      const income = await s.category('Bônus', 'INCOME');
      const mismatch = await s
        .create({
          type: 'EXPENSE',
          amount: '1.00',
          description: 'X',
          date: TODAY,
          accountId: acc,
          categoryId: income,
        })
        .expect(400);
      expect(error(mismatch).code).toBe('CATEGORY_TYPE_MISMATCH');

      const other = await setup('tx-balance-other');
      const foreignAcc = await other.account('Alheia');
      const foreignCat = await other.category('Alheia', 'EXPENSE');
      expect(
        error(
          await s
            .create({
              type: 'EXPENSE',
              amount: '1.00',
              description: 'X',
              date: TODAY,
              accountId: foreignAcc,
            })
            .expect(404),
        ).code,
      ).toBe('ACCOUNT_NOT_FOUND');
      expect(
        error(
          await s
            .create({
              type: 'EXPENSE',
              amount: '1.00',
              description: 'X',
              date: TODAY,
              accountId: acc,
              categoryId: foreignCat,
            })
            .expect(404),
        ).code,
      ).toBe('CATEGORY_NOT_FOUND');

      const [mine] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '1.00',
            description: 'Minha',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      for (const res of [
        await other.client.get(`/api/transactions/${mine.id}`),
        await other.client.patch(`/api/transactions/${mine.id}`).send({ description: 'Hack' }),
        await other.client.post(`/api/transactions/${mine.id}/confirm`),
        await other.client.post(`/api/transactions/${mine.id}/duplicate`),
        await other.client.delete(`/api/transactions/${mine.id}`),
      ]) {
        expect(res.status).toBe(404);
        expect(error(res).code).toBe('TRANSACTION_NOT_FOUND');
      }
      expect(data<Tx[]>(await other.client.get('/api/transactions'))).toHaveLength(0);
    });

    it('valida valor, tipo e campos proibidos', async () => {
      for (const amount of ['0', '0.00', '-5.00', '1000000000000.00', 12]) {
        await s
          .create({ type: 'EXPENSE', amount, description: 'X', date: TODAY, accountId: acc })
          .expect(400);
      }
      await s
        .create({ type: 'TRANSFER', amount: '1.00', description: 'X', date: TODAY, accountId: acc })
        .expect(400);
      await s
        .create({
          type: 'EXPENSE',
          amount: '1.00',
          description: 'X',
          date: '2026-02-30',
          accountId: acc,
        })
        .expect(400);
      const [row] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '1.00',
            description: 'X',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      await s.client.patch(`/api/transactions/${row.id}`).send({ type: 'INCOME' }).expect(400);
    });

    it('duplicate cria avulso com data de hoje', async () => {
      const [orig] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '12.34',
            description: 'Assinatura',
            date: addDays(TODAY, -40),
            accountId: acc,
            tags: ['streaming'],
            repeat: { kind: 'INSTALLMENTS', count: 3 },
          })
          .expect(201),
      );
      const before = await s.balance(acc);
      const copy = data<Tx>(
        await s.client.post(`/api/transactions/${orig.id}/duplicate`).expect(201),
      );
      expect(copy).toMatchObject({
        date: TODAY,
        status: 'CLEARED',
        installment: null,
        recurring: null,
        amount: orig.amount,
      });
      expect(copy.tags.map((t) => t.name)).toEqual(['streaming']);
      expect(await s.balance(acc)).toBe((Number(before) - Number(orig.amount)).toFixed(2));
    });
  });

  describe('parcelas', () => {
    it('10× de 1000.00 desde 31/01: somas exatas, datas ajustadas, saldo só das confirmadas', async () => {
      const s = await setup('tx-installments');
      const acc = await s.account('Cartão débito', '0.00');
      const rows = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '1000.00',
            description: 'Notebook',
            date: '2026-01-31',
            accountId: acc,
            repeat: { kind: 'INSTALLMENTS', count: 10 },
          })
          .expect(201),
      );
      const expectedDates = installmentDates('2026-01-31', 10);
      expect(rows.map((r) => r.date)).toEqual(expectedDates);
      expect(rows.slice(0, 3).map((r) => r.date)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
      ]);
      expect(rows.map((r) => r.installment?.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(new Set(rows.map((r) => r.installment?.groupId)).size).toBe(1);
      expect(rows.every((r) => r.description === 'Notebook' && r.amount === '100.00')).toBe(true);
      for (const r of rows) expect(r.status).toBe(r.date <= TODAY ? 'CLEARED' : 'PENDING');

      const cleared = rows.filter((r) => r.status === 'CLEARED').length;
      expect(await s.balance(acc)).toBe((-100 * cleared).toFixed(2));

      const odd = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '100.00',
            description: 'Tênis',
            date: TODAY,
            accountId: acc,
            repeat: { kind: 'INSTALLMENTS', count: 3 },
          })
          .expect(201),
      );
      expect(odd.map((r) => r.amount)).toEqual(['33.34', '33.33', '33.33']);

      // PATCH scope=all: descrição propaga, valores e datas não.
      const updated = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${rows[4].id}?scope=all`)
          .send({ description: 'Notebook Pro', amount: '150.00' })
          .expect(200),
      );
      expect(updated).toHaveLength(10);
      expect(updated.every((r) => r.description === 'Notebook Pro')).toBe(true);
      expect(
        updated.filter((r) => r.amount === '150.00').map((r) => r.installment?.number),
      ).toEqual([5]);
      expect(updated.map((r) => r.date)).toEqual(expectedDates);

      // DELETE scope=future a partir da 8ª.
      await s.client.delete(`/api/transactions/${rows[7].id}?scope=future`).expect(204);
      expect(
        await ctx.prisma.transaction.count({
          where: { installmentGroupId: rows[0].installment?.groupId },
        }),
      ).toBe(7);
      await assertInvariant(s.user.id);
    });
  });

  describe('recorrências', () => {
    let s: Awaited<ReturnType<typeof setup>>;
    let acc: string;
    let engine: RecurrenceService;

    beforeAll(async () => {
      s = await setup('tx-recurring');
      acc = await s.account('Conta corrente', '1000.00');
      engine = ctx.app.get(RecurrenceService);
    });

    it('mensal materializa até hoje + 60 dias; motor é idempotente', async () => {
      const start = addMonthsClamped(TODAY, -2);
      const rows = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '89.90',
            description: 'Academia',
            date: start,
            accountId: acc,
            repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
          })
          .expect(201),
      );
      const expected = recurrenceDates({
        start,
        frequency: 'MONTHLY',
        interval: 1,
        until: addDays(TODAY, 60),
      });
      expect(rows.map((r) => r.date)).toEqual(expected);
      expect(rows[0].status).toBe('CLEARED');
      expect(rows.slice(1).every((r) => r.status === 'PENDING')).toBe(true);
      expect(rows[0].recurring).toMatchObject({ active: true, endDate: null });
      expect(await s.balance(acc)).toBe('910.10');

      const templateId = rows[0].recurring?.id ?? '';
      await engine.run();
      await engine.run();
      expect(
        await ctx.prisma.transaction.count({ where: { recurringTransactionId: templateId } }),
      ).toBe(expected.length);
    });

    it('autoConfirm confirma ocorrências vencidas no motor', async () => {
      const rows = data<Tx[]>(
        await s
          .create({
            type: 'INCOME',
            amount: '10.00',
            description: 'Cashback',
            date: addDays(TODAY, -3),
            accountId: acc,
            repeat: {
              kind: 'RECURRING',
              frequency: 'DAILY',
              autoConfirm: true,
              endDate: addDays(TODAY, 2),
            },
          })
          .expect(201),
      );
      expect(rows.map((r) => r.status)).toEqual([
        'CLEARED',
        'CLEARED',
        'CLEARED',
        'CLEARED',
        'PENDING',
        'PENDING',
      ]);
      const due = rows[2];
      await s.client.post(`/api/transactions/${due.id}/unconfirm`).expect(200);
      const before = await s.balance(acc);
      const result = await engine.run();
      expect(result.confirmed).toBeGreaterThanOrEqual(1);
      expect(data<Tx>(await s.client.get(`/api/transactions/${due.id}`)).status).toBe('CLEARED');
      expect(await s.balance(acc)).toBe((Number(before) + 10).toFixed(2));
      await assertInvariant(s.user.id);
    });

    it('PATCH scope single/future/all numa série recorrente (inclui o modelo)', async () => {
      const start = addMonthsClamped(TODAY, -1);
      const rows = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '50.00',
            description: 'Internet',
            date: start,
            accountId: acc,
            repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
          })
          .expect(201),
      );
      expect(rows.length).toBeGreaterThanOrEqual(3);
      const templateId = rows[0].recurring?.id ?? '';

      const single = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${rows[1].id}?scope=single`)
          .send({ description: 'Internet (desconto)' })
          .expect(200),
      );
      expect(single.map((r) => r.id)).toEqual([rows[1].id]);

      const future = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${rows[1].id}?scope=future`)
          .send({ amount: '60.00' })
          .expect(200),
      );
      expect(future.map((r) => r.id).sort()).toEqual(
        rows
          .slice(1)
          .map((r) => r.id)
          .sort(),
      );
      expect(future.every((r) => r.amount === '60.00')).toBe(true);
      expect(data<Tx>(await s.client.get(`/api/transactions/${rows[0].id}`)).amount).toBe('50.00');
      expect(
        (
          await ctx.prisma.recurringTransaction.findUniqueOrThrow({ where: { id: templateId } })
        ).amount.toFixed(2),
      ).toBe('60.00');

      const all = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${rows[2].id}?scope=all`)
          .send({ description: 'Fibra', notes: 'plano 500MB' })
          .expect(200),
      );
      expect(all).toHaveLength(rows.length);
      expect(all.every((r) => r.description === 'Fibra' && r.notes === 'plano 500MB')).toBe(true);
      await assertInvariant(s.user.id);
    });

    it('DELETE scope=future desativa o modelo com endDate = véspera', async () => {
      const start = addDays(TODAY, -14);
      const rows = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '5.00',
            description: 'Café semanal',
            date: start,
            accountId: acc,
            repeat: { kind: 'RECURRING', frequency: 'WEEKLY' },
          })
          .expect(201),
      );
      const pivot = rows[2];
      await s.client.delete(`/api/transactions/${pivot.id}?scope=future`).expect(204);
      const templateId = rows[0].recurring?.id ?? '';
      const template = await ctx.prisma.recurringTransaction.findUniqueOrThrow({
        where: { id: templateId },
      });
      expect(template.active).toBe(false);
      expect(template.endDate?.toISOString().slice(0, 10)).toBe(addDays(pivot.date, -1));
      expect(
        await ctx.prisma.transaction.count({ where: { recurringTransactionId: templateId } }),
      ).toBe(2);
      await engine.run();
      expect(
        await ctx.prisma.transaction.count({ where: { recurringTransactionId: templateId } }),
      ).toBe(2);
      await assertInvariant(s.user.id);
    });
  });

  describe('listagem, filtros e totais', () => {
    let s: Awaited<ReturnType<typeof setup>>;
    const ids: Record<string, string> = {};
    let acc1: string;
    let acc2: string;
    let food: string;
    let market: string;

    const list = async (query: string) =>
      (await s.client.get(`/api/transactions?${query}`).expect(200)).body as ListBody;
    const names = (body: ListBody) => body.data.map((t) => t.description);

    beforeAll(async () => {
      s = await setup('tx-list');
      acc1 = await s.account('Conta 1', '0.00');
      acc2 = await s.account('Conta 2', '0.00');
      food = await s.category('Alimentação', 'EXPENSE');
      market = await s.category('Mercado', 'EXPENSE', food);
      const salary = await s.category('Salário', 'INCOME');
      const add = async (key: string, body: Record<string, unknown>) => {
        ids[key] = data<Tx[]>(await s.create({ accountId: acc1, ...body }).expect(201))[0].id;
      };
      await add('salario', {
        type: 'INCOME',
        amount: '5000.00',
        description: 'Salário março',
        date: '2025-03-05',
        categoryId: salary,
      });
      await add('mercado', {
        type: 'EXPENSE',
        amount: '150.00',
        description: 'Compra no Mercado',
        date: '2025-03-10',
        categoryId: market,
        tags: ['casa'],
      });
      await add('almoco', {
        type: 'EXPENSE',
        amount: '45.90',
        description: 'Almoço',
        date: '2025-03-12',
        categoryId: food,
        notes: 'Restaurante Açaí',
      });
      await add('luz', {
        type: 'EXPENSE',
        amount: '300.00',
        description: 'Conta de luz',
        date: '2025-03-20',
        status: 'PENDING',
      });
      ids.transfer = data<Tx>(
        await s.client
          .post('/api/transactions/transfers')
          .send({
            fromAccountId: acc1,
            toAccountId: acc2,
            amount: '1000.00',
            date: '2025-03-15',
            description: 'Reserva',
          })
          .expect(201),
      ).id;
      await add('cafe', {
        type: 'EXPENSE',
        amount: '20.00',
        description: 'Café',
        date: '2025-04-02',
      });
    });

    it('período + totais do filtro inteiro (transferências neutras)', async () => {
      const march = await list('from=2025-03-01&to=2025-03-31');
      expect(names(march)).toEqual([
        'Conta de luz',
        'Reserva',
        'Almoço',
        'Compra no Mercado',
        'Salário março',
      ]);
      expect(march.meta).toMatchObject({ page: 1, pageSize: 50, total: 5, totalPages: 1 });
      expect(march.meta.totals).toEqual({
        income: '5000.00',
        expense: '495.90',
        net: '4504.10',
        pendingIncome: '0.00',
        pendingExpense: '300.00',
      });
    });

    it('filtros por tipo, conta (inclui destino), categoria (com/sem filhas), status, tag, busca e valor', async () => {
      expect((await list('type=EXPENSE')).meta.total).toBe(4);
      expect(names(await list(`accountId=${acc2}`))).toEqual(['Reserva']);
      expect(names(await list(`categoryId=${food}`))).toEqual(['Almoço', 'Compra no Mercado']);
      expect(names(await list(`categoryId=${food}&includeSubcategories=false`))).toEqual([
        'Almoço',
      ]);
      expect(names(await list('status=PENDING'))).toEqual(['Conta de luz']);
      const tagId = data<Tx>(await s.client.get(`/api/transactions/${ids.mercado}`)).tags[0].id;
      expect(names(await list(`tagId=${tagId}`))).toEqual(['Compra no Mercado']);
      expect(names(await list('q=acai'))).toEqual(['Almoço']);
      expect(names(await list('q=MERCADO'))).toEqual(['Compra no Mercado']);
      expect(names(await list('q=salario'))).toEqual(['Salário março']);
      expect(names(await list('minAmount=100&maxAmount=1000&sort=amount&order=asc'))).toEqual([
        'Compra no Mercado',
        'Conta de luz',
        'Reserva',
      ]);
      const transfers = await list('type=TRANSFER');
      expect(transfers.meta.totals).toMatchObject({ income: '0.00', expense: '0.00', net: '0.00' });
    });

    it('ordenação e paginação', async () => {
      expect(names(await list('sort=amount&order=asc&pageSize=1'))).toEqual(['Café']);
      expect(names(await list('sort=description&order=asc&pageSize=2'))).toEqual([
        'Almoço',
        'Café',
      ]);
      const page2 = await list('pageSize=2&page=2');
      expect(page2.meta).toMatchObject({ page: 2, pageSize: 2, total: 6, totalPages: 3 });
      expect(names(page2)).toEqual(['Reserva', 'Almoço']);
      expect(page2.meta.totals.income).toBe('5000.00');
      await s.client.get('/api/transactions?pageSize=101').expect(400);
      await s.client.get('/api/transactions?from=2025-13-01').expect(400);
    });

    it('tags: criação sob demanda, dedupe case-insensitive, CRUD', async () => {
      const [first] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '1.00',
            description: 'T1',
            date: '2025-05-01',
            accountId: acc1,
            tags: ['Viagem', 'viagem', 'Trabalho'],
          })
          .expect(201),
      );
      expect(first.tags.map((t) => t.name)).toEqual(['Trabalho', 'Viagem']);
      const [second] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '1.00',
            description: 'T2',
            date: '2025-05-02',
            accountId: acc1,
            tags: ['VIAGEM'],
          })
          .expect(201),
      );
      expect(second.tags[0].id).toBe(first.tags.find((t) => t.name === 'Viagem')?.id);

      const tags = data<{ id: string; name: string; color: string; transactionCount: number }[]>(
        await s.client.get('/api/tags').expect(200),
      );
      expect(tags.map((t) => [t.name, t.transactionCount])).toEqual([
        ['casa', 1],
        ['Trabalho', 1],
        ['Viagem', 2],
      ]);
      expect(tags.every((t) => /^#[0-9A-F]{6}$/i.test(t.color))).toBe(true);
      const travel = tags.find((t) => t.name === 'Viagem');
      const work = tags.find((t) => t.name === 'Trabalho');
      expect(
        error(
          await s.client.patch(`/api/tags/${travel?.id}`).send({ name: 'TRABALHO' }).expect(409),
        ).code,
      ).toBe('TAG_ALREADY_EXISTS');
      await s.client
        .patch(`/api/tags/${travel?.id}`)
        .send({ name: 'Viagens', color: '#0EA5E9' })
        .expect(200);
      await s.client.delete(`/api/tags/${work?.id}`).expect(204);
      expect(
        data<Tx>(await s.client.get(`/api/transactions/${first.id}`)).tags.map((t) => t.name),
      ).toEqual(['Viagens']);
      const { client: other } = await quickUser(ctx, 'tx-tags-other');
      expect(error(await other.delete(`/api/tags/${travel?.id}`).expect(404)).code).toBe(
        'TAG_NOT_FOUND',
      );

      // PATCH substitui o conjunto de tags.
      const replaced = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${first.id}`)
          .send({ tags: ['casa'] })
          .expect(200),
      );
      expect(replaced[0].tags.map((t) => t.name)).toEqual(['casa']);
    });

    it('/search global sem acentos', async () => {
      expect(error(await s.client.get('/api/search?q=a').expect(400)).code).toBe(
        'VALIDATION_ERROR',
      );
      const res = data<{
        transactions: Tx[];
        accounts: { name: string }[];
        categories: { name: string }[];
        cards: unknown[];
        goals: unknown[];
        investments: unknown[];
      }>(await s.client.get('/api/search?q=alimentacao').expect(200));
      expect(res.categories.map((c) => c.name)).toEqual(['Alimentação']);
      expect(res).toMatchObject({ cards: [], goals: [], investments: [] });

      const byTx = data<{ transactions: Tx[]; accounts: { name: string }[] }>(
        await s.client.get('/api/search?q=conta&limit=5').expect(200),
      );
      expect(byTx.transactions.map((t) => t.description)).toEqual(['Conta de luz']);
      expect(byTx.accounts.map((a) => a.name)).toEqual(['Conta 1', 'Conta 2']);
    });
  });

  it('invariante de saldo após uma sequência variada de operações', async () => {
    const s = await setup('tx-invariant');
    const a = await s.account('A', '1000.00');
    const b = await s.account('B', '-50.00');
    const cat = await s.category('Diversos', 'EXPENSE');
    const made: string[] = [];
    const push = (res: { body: unknown }) => {
      const value = data<Tx | Tx[]>(res);
      made.push(...(Array.isArray(value) ? value : [value]).map((t) => t.id));
    };

    push(
      await s
        .create({
          type: 'INCOME',
          amount: '333.33',
          description: 'R1',
          date: addDays(TODAY, -10),
          accountId: a,
        })
        .expect(201),
    );
    push(
      await s
        .create({
          type: 'EXPENSE',
          amount: '0.01',
          description: 'D1',
          date: TODAY,
          accountId: b,
          categoryId: cat,
        })
        .expect(201),
    );
    push(
      await s
        .create({
          type: 'EXPENSE',
          amount: '250.00',
          description: 'Parc',
          date: addDays(TODAY, -45),
          accountId: a,
          repeat: { kind: 'INSTALLMENTS', count: 4 },
        })
        .expect(201),
    );
    push(
      await s.client
        .post('/api/transactions/transfers')
        .send({ fromAccountId: a, toAccountId: b, amount: '75.50', date: addDays(TODAY, -1) })
        .expect(201),
    );
    push(
      await s.client
        .post('/api/transactions/transfers')
        .send({ fromAccountId: b, toAccountId: a, amount: '10.00', date: addDays(TODAY, 3) })
        .expect(201),
    );

    await s.client
      .patch(`/api/transactions/${made[0]}`)
      .send({ amount: '400.00', accountId: b })
      .expect(200);
    await s.client.patch(`/api/transactions/${made[1]}`).send({ status: 'PENDING' }).expect(200);
    await s.client
      .patch(`/api/transactions/${made[6]}`)
      .send({ fromAccountId: b, toAccountId: a })
      .expect(200);
    await s.client
      .patch(`/api/transactions/${made[6]}`)
      .send({ amount: '80.00', date: addDays(TODAY, -2) })
      .expect(200);
    await s.client.post(`/api/transactions/${made[1]}/confirm`).expect(200);
    await s.client
      .patch(`/api/transactions/${made[0]}`)
      .send({ date: addDays(TODAY, 7) })
      .expect(200); // continua pago: status não depende da data
    await s.client.delete(`/api/transactions/${made[3]}`).expect(204);
    await s.client.post(`/api/transactions/${made[2]}/duplicate`).expect(201);
    await s.client.delete(`/api/transactions/${made[7]}`).expect(204);

    expect(data<Tx>(await s.client.get(`/api/transactions/${made[0]}`)).status).toBe('CLEARED');
    await assertInvariant(s.user.id);
  });
});
