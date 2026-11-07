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
  categoryAuto: boolean;
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

    it('com data final, lança todas as ocorrências até ela (além do horizonte de 60 dias)', async () => {
      const endDate = addMonthsClamped(TODAY, 5);
      const rows = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '50.00',
            description: 'Academia',
            date: TODAY,
            accountId: acc,
            repeat: { kind: 'RECURRING', frequency: 'MONTHLY', endDate },
          })
          .expect(201),
      );
      expect(rows.map((r) => r.date)).toEqual(
        recurrenceDates({
          start: TODAY,
          frequency: 'MONTHLY',
          interval: 1,
          endDate,
          until: endDate,
        }),
      );
      expect(rows).toHaveLength(6);
      expect((rows.at(-1)?.date ?? '') <= endDate).toBe(true);
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

  // Contrato do PATCH: o par { accountId, creditCardId: null } do POST não vale na edição.
  it('PATCH com o corpo antigo do compositor (creditCardId: null) → 400 "Cartão inválido", nada muda', async () => {
    const s = await setup('tx-edit-old-body');
    const acc = await s.account('Principal', '500.00');
    const [tx] = data<Tx[]>(
      await s
        .create({
          type: 'EXPENSE',
          amount: '86.66',
          description: 'Mercado',
          date: TODAY,
          accountId: acc,
        })
        .expect(201),
    );
    expect(await s.balance(acc)).toBe('413.34');

    const res = await s.client
      .patch(`/api/transactions/${tx.id}?scope=single`)
      .send({
        amount: '86.65',
        description: 'Mercado',
        date: TODAY,
        status: 'CLEARED',
        accountId: acc,
        creditCardId: null,
        categoryId: null,
        notes: null,
        tags: [],
      })
      .expect(400);
    expect(error(res).code).toBe('VALIDATION_ERROR');
    expect(error(res).details).toEqual([
      expect.objectContaining({ field: 'creditCardId', message: 'Cartão inválido' }),
    ]);

    const after = data<Tx>(await s.client.get(`/api/transactions/${tx.id}`).expect(200));
    expect(after).toMatchObject({ amount: '86.66', account: { id: acc } });
    expect(await s.balance(acc)).toBe('413.34');
  });

  // Preservação (3.4–3.8, 3.13): o contrato do PATCH em receitas/despesas em conta não muda.
  describe('preservação do contrato do PATCH', () => {
    let s: Awaited<ReturnType<typeof setup>>;
    let acc: string;
    let card: string;

    beforeAll(async () => {
      s = await setup('tx-edit-contract');
      acc = await s.account('Principal', '500.00');
      card = data<{ id: string }>(
        await s.client
          .post('/api/cards')
          .send({
            name: 'Cartão',
            brand: 'VISA',
            limit: '1000.00',
            closingDay: 3,
            dueDay: 10,
            color: '#123456',
          })
          .expect(201),
      ).id;
    });

    const expectField = (res: { body: unknown }, field: string, message: string): void => {
      expect(error(res).code).toBe('VALIDATION_ERROR');
      expect(error(res).details).toEqual([expect.objectContaining({ field, message })]);
    };

    it('despesa em conta: ids nulos/vazios/malformados, ambos, conta arquivada ou alheia, outro usuário → mesmos erros, nada muda', async () => {
      const [tx] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '40.00',
            description: 'Mercado',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      const balanceBefore = await s.balance(acc);
      const archived = await s.account('Arquivada');
      await s.client.post(`/api/accounts/${archived}/archive`).expect(200);
      const other = await setup('tx-edit-contract-other');
      const foreign = await other.account('Alheia');

      const patch = (body: Record<string, unknown>) =>
        s.client.patch(`/api/transactions/${tx.id}`).send({ amount: '41.00', ...body });

      for (const bad of [null, '', 'abc']) {
        expectField(await patch({ accountId: bad }).expect(400), 'accountId', 'Conta inválida');
        expectField(
          await patch({ creditCardId: bad }).expect(400),
          'creditCardId',
          'Cartão inválido',
        );
      }
      expectField(
        await patch({ accountId: acc, creditCardId: card }).expect(400),
        'creditCardId',
        'Informe conta OU cartão, não ambos',
      );
      expect(error(await patch({ accountId: foreign }).expect(404)).code).toBe('ACCOUNT_NOT_FOUND');
      expect(error(await patch({ accountId: archived }).expect(400)).code).toBe('ACCOUNT_ARCHIVED');
      expect(
        error(
          await other.client
            .patch(`/api/transactions/${tx.id}`)
            .send({ amount: '1.00' })
            .expect(404),
        ).code,
      ).toBe('TRANSACTION_NOT_FOUND');

      const after = data<Tx>(await s.client.get(`/api/transactions/${tx.id}`).expect(200));
      expect(after).toMatchObject({ amount: '40.00', account: { id: acc } });
      expect(await s.balance(acc)).toBe(balanceBefore);
    });

    it('receita: creditCardId → "Somente despesas podem ser lançadas no cartão", nada muda', async () => {
      const [income] = data<Tx[]>(
        await s
          .create({
            type: 'INCOME',
            amount: '100.00',
            description: 'Freela',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      const balanceBefore = await s.balance(acc);
      expectField(
        await s.client
          .patch(`/api/transactions/${income.id}`)
          .send({ creditCardId: card })
          .expect(400),
        'creditCardId',
        'Somente despesas podem ser lançadas no cartão',
      );
      const after = data<Tx>(await s.client.get(`/api/transactions/${income.id}`).expect(200));
      expect(after).toMatchObject({ type: 'INCOME', amount: '100.00', account: { id: acc } });
      expect(await s.balance(acc)).toBe(balanceBefore);
    });

    it('lançamento vinculado a investimento: valor bloqueado (LINKED_TRANSACTION), textos e tags liberados', async () => {
      const investment = data<{ id: string }>(
        await s.client
          .post('/api/investments')
          .send({
            name: 'Ações',
            type: 'STOCKS',
            quantity: '10',
            averagePrice: '10',
            currentValue: '100.00',
            appliedAt: '2026-01-02',
            liquidity: 'DAILY',
          })
          .expect(201),
      ).id;
      await s.client
        .post(`/api/investments/${investment}/transactions`)
        .send({ type: 'DIVIDEND', amount: '12.00', date: TODAY, accountId: acc })
        .expect(201);
      const { transactionId } = await ctx.prisma.investmentTransaction.findFirstOrThrow({
        where: { investmentId: investment, type: 'DIVIDEND' },
      });
      const linkedId = transactionId ?? '';
      const before = data<Tx>(await s.client.get(`/api/transactions/${linkedId}`).expect(200));
      const balanceBefore = await s.balance(acc);

      for (const body of [
        { amount: '13.00' },
        { date: addDays(TODAY, -1) },
        { status: 'PENDING' },
        { accountId: acc },
      ]) {
        expect(
          error(await s.client.patch(`/api/transactions/${linkedId}`).send(body).expect(400)).code,
        ).toBe('LINKED_TRANSACTION');
      }

      const [edited] = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${linkedId}`)
          .send({ description: 'Dividendos ajustados', notes: 'jan', tags: ['renda'] })
          .expect(200),
      );
      expect(edited).toMatchObject({
        description: 'Dividendos ajustados',
        notes: 'jan',
        amount: before.amount,
        date: before.date,
        status: before.status,
        account: { id: acc },
      });
      expect(edited.tags.map((t) => t.name)).toEqual(['renda']);
      expect(await s.balance(acc)).toBe(balanceBefore);
    });
  });

  // Correção (2.3, 2.4, 3.3, 3.10): corpos iguais aos que `toTransactionPatch` produz.
  describe('PATCH com o corpo corrigido do compositor', () => {
    let s: Awaited<ReturnType<typeof setup>>;

    beforeAll(async () => {
      s = await setup('tx-edit-fixed-body');
    });

    /** Corpo da edição a partir do lançamento atual; sem `accountId`/`creditCardId` se não houver troca. */
    const editBody = (row: Tx, changes: Record<string, unknown> = {}) => ({
      amount: row.amount,
      description: row.description,
      date: row.date,
      status: row.status,
      categoryId: row.category?.id ?? null,
      notes: row.notes,
      tags: row.tags.map((t) => t.name),
      ...changes,
    });
    const money = (n: number) => n.toFixed(2);

    it('despesa e receita avulsas em conta, só valor → 200, conta mantida, saldo ajustado', async () => {
      const acc = await s.account('Avulsas', '500.00');
      const [expense] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '86.66',
            description: 'Mercado',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      const [income] = data<Tx[]>(
        await s
          .create({
            type: 'INCOME',
            amount: '100.00',
            description: 'Freela',
            date: TODAY,
            accountId: acc,
          })
          .expect(201),
      );
      expect(await s.balance(acc)).toBe('513.34');

      const [e] = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${expense.id}?scope=single`)
          .send(editBody(expense, { amount: '86.65' }))
          .expect(200),
      );
      expect(e).toMatchObject({ amount: '86.65', account: { id: acc }, creditCard: null });
      expect(await s.balance(acc)).toBe('513.35');

      const [i] = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${income.id}?scope=single`)
          .send(editBody(income, { amount: '120.00' }))
          .expect(200),
      );
      expect(i).toMatchObject({ amount: '120.00', account: { id: acc }, creditCard: null });
      expect(await s.balance(acc)).toBe('533.35');
      await assertInvariant(s.user.id);
    });

    it('despesa e receita recorrentes em conta, só valor (future/all) → 200, conta mantida, saldo das efetivadas ajustado', async () => {
      const acc = await s.account('Séries', '1000.00');
      const start = addMonthsClamped(TODAY, -1);
      const series = async (type: 'INCOME' | 'EXPENSE', amount: string) =>
        data<Tx[]>(
          await s
            .create({
              type,
              amount,
              description: type === 'INCOME' ? 'Aluguel recebido' : 'Internet',
              date: start,
              accountId: acc,
              repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
            })
            .expect(201),
        );
      const expenses = await series('EXPENSE', '50.00');
      const incomes = await series('INCOME', '200.00');
      expect(expenses.length).toBeGreaterThanOrEqual(3);
      const cleared = (rows: Tx[]) => rows.filter((r) => r.status === 'CLEARED').length;
      let expected = 1000 - 50 * cleared(expenses) + 200 * cleared(incomes);
      expect(await s.balance(acc)).toBe(money(expected));

      const future = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${expenses[1].id}?scope=future`)
          .send(editBody(expenses[1], { amount: '60.00' }))
          .expect(200),
      );
      expect(future).toHaveLength(expenses.length - 1);
      for (const r of future) {
        expect(r).toMatchObject({ amount: '60.00', account: { id: acc }, creditCard: null });
      }
      expected -= 10 * cleared(future);
      expect(await s.balance(acc)).toBe(money(expected));

      const all = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${incomes[2].id}?scope=all`)
          .send(editBody(incomes[2], { amount: '210.00' }))
          .expect(200),
      );
      expect(all).toHaveLength(incomes.length);
      for (const r of all) {
        expect(r).toMatchObject({ amount: '210.00', account: { id: acc }, creditCard: null });
      }
      expected += 10 * cleared(all);
      expect(await s.balance(acc)).toBe(money(expected));

      for (const rows of [expenses, incomes]) {
        const { recurringTransactionId } = await ctx.prisma.transaction.findUniqueOrThrow({
          where: { id: rows[0].id },
        });
        const tpl = await ctx.prisma.recurringTransaction.findUniqueOrThrow({
          where: { id: recurringTransactionId ?? '' },
        });
        expect(tpl).toMatchObject({ accountId: acc, creditCardId: null });
      }
      await assertInvariant(s.user.id);
    });

    it('conta A → conta B com { accountId: B } → saldos de A e B ajustados', async () => {
      const a = await s.account('Conta A', '500.00');
      const b = await s.account('Conta B', '0.00');
      const [tx] = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '40.00',
            description: 'Farmácia',
            date: TODAY,
            accountId: a,
          })
          .expect(201),
      );
      expect(await s.balance(a)).toBe('460.00');

      const [moved] = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${tx.id}`)
          .send(editBody(tx, { accountId: b }))
          .expect(200),
      );
      expect(moved).toMatchObject({ account: { id: b }, creditCard: null });
      expect(await s.balance(a)).toBe('500.00');
      expect(await s.balance(b)).toBe('-40.00');
      await assertInvariant(s.user.id);
    });
  });

  describe('categorização automática (sem categoria escolhida)', () => {
    it('usa o histórico do usuário, depois palavra-chave; nunca sobrescreve nem inventa', async () => {
      const s = await setup('tx-autocat');
      const acc = await s.account('Corrente', '500.00');
      const transporte = await s.category('Transporte', 'EXPENSE');
      const lazer = await s.category('Lazer', 'EXPENSE');
      const salario = await s.category('Salário', 'INCOME');
      const one = async (body: Record<string, unknown>) =>
        data<Tx[]>(
          await s.create({ amount: '10.00', date: TODAY, accountId: acc, ...body }).expect(201),
        )[0];

      // Palavra-chave → categoria com o nome padrão (sem categoryId e com categoryId null).
      expect((await one({ type: 'EXPENSE', description: 'Uber pro centro' })).category?.id).toBe(
        transporte,
      );
      expect(
        (await one({ type: 'EXPENSE', description: 'Gasolina', categoryId: null })).category?.id,
      ).toBe(transporte);
      expect((await one({ type: 'INCOME', description: 'Salário outubro' })).category?.id).toBe(
        salario,
      );
      // Categoria escolhida pelo usuário sempre vale.
      expect(
        (await one({ type: 'EXPENSE', description: 'Uber', categoryId: lazer })).category?.id,
      ).toBe(lazer);
      // Sem pista nenhuma → continua sem categoria.
      expect((await one({ type: 'EXPENSE', description: 'Presente da Ana' })).category).toBeNull();

      // Histórico ganha da palavra-chave e ignora dígitos/acentos: "Posto 123" já foi Lazer.
      await one({ type: 'EXPENSE', description: 'Posto Avenida 123', categoryId: lazer });
      expect((await one({ type: 'EXPENSE', description: 'POSTO AVENIDA 77' })).category?.id).toBe(
        lazer,
      );

      // O tipo precisa casar: aprendizado de despesa não vale para receita.
      expect((await one({ type: 'INCOME', description: 'Posto Avenida' })).category).toBeNull();
    });

    it('marca a categoria automática, não aprende com ela até o usuário confirmar', async () => {
      const s = await setup('tx-autocat-flag');
      const acc = await s.account('Corrente', '500.00');
      const transporte = await s.category('Transporte', 'EXPENSE');
      const lazer = await s.category('Lazer', 'EXPENSE');
      const one = async (body: Record<string, unknown>) =>
        data<Tx[]>(
          await s.create({ amount: '10.00', date: TODAY, accountId: acc, ...body }).expect(201),
        )[0];

      expect(await one({ type: 'EXPENSE', description: 'Uber' })).toMatchObject({
        category: { id: transporte },
        categoryAuto: true,
      });
      expect(await one({ type: 'EXPENSE', description: 'Uber', categoryId: lazer })).toMatchObject({
        category: { id: lazer },
        categoryAuto: false,
      });
      expect(await one({ type: 'EXPENSE', description: 'Nada a ver' })).toMatchObject({
        category: null,
        categoryAuto: false,
      });

      // Usuário escolhe Lazer (antigo); um novo sem categoria herda Lazer automaticamente (recente).
      const first = await one({
        type: 'EXPENSE',
        description: 'Bar do Zé 1',
        categoryId: lazer,
        date: addDays(TODAY, -2),
      });
      const auto = await one({
        type: 'EXPENSE',
        description: 'Bar do Zé 2',
        date: addDays(TODAY, -1),
      });
      expect(auto).toMatchObject({ category: { id: lazer }, categoryAuto: true });

      // O usuário corrige o antigo: a sugestão segue a escolha dele, não o palpite mais recente.
      await s.client
        .patch(`/api/transactions/${first.id}`)
        .send({ categoryId: transporte })
        .expect(200);
      expect((await one({ type: 'EXPENSE', description: 'Bar do Zé 3' })).category?.id).toBe(
        transporte,
      );

      // Confirmar (reenviar a mesma categoria) vira escolha do usuário e passa a valer no aprendizado.
      const [confirmed] = data<Tx[]>(
        await s.client
          .patch(`/api/transactions/${auto.id}?scope=single`)
          .send({ categoryId: lazer })
          .expect(200),
      );
      expect(confirmed.categoryAuto).toBe(false);
      expect((await one({ type: 'EXPENSE', description: 'Bar do Zé 4' })).category?.id).toBe(lazer);

      // Recorrência criada com categoria automática propaga a marca às ocorrências.
      const series = data<Tx[]>(
        await s
          .create({
            type: 'EXPENSE',
            amount: '30.00',
            date: addMonthsClamped(TODAY, -2),
            accountId: acc,
            description: 'Uber mensal',
            repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
          })
          .expect(201),
      );
      expect(series.length).toBeGreaterThan(1);
      expect(series.every((t) => t.categoryAuto && t.category?.id === transporte)).toBe(true);
    });

    it('GET /categories/suggest devolve a categoria que seria aplicada', async () => {
      const s = await setup('tx-autocat-suggest');
      const transporte = await s.category('Transporte', 'EXPENSE');
      const suggest = (q: string) => s.client.get(`/api/categories/suggest?${q}`);

      expect(
        data<{ category: { id: string; name: string } | null }>(
          await suggest('description=Uber%20pro%20centro&type=EXPENSE').expect(200),
        ).category,
      ).toMatchObject({ id: transporte, name: 'Transporte' });
      expect(
        data<{ category: unknown }>(await suggest('description=Uber&type=INCOME').expect(200))
          .category,
      ).toBeNull();
      expect(error(await suggest('type=EXPENSE').expect(400)).code).toBe('VALIDATION_ERROR');
    });
  });
});
