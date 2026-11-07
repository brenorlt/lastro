import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addMonthsYm, monthStart, todayIn, yearMonthOf } from '../src/common/utils/date-only.js';
import { type AuthedClient, type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface Budget {
  id: string;
  month: string;
  category: { id: string; name: string };
  limitAmount: string;
  spent: string;
  remaining: string;
  percent: number;
  level: string;
}
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
}
interface Goal {
  id: string;
  status: string;
  currentAmount: string;
  remaining: string;
  progress: number;
  requiredMonthly: string | null;
  monthsLeft: number | null;
  contributionsCount: number;
  onTrack: boolean | null;
}

const TODAY = todayIn('America/Sao_Paulo');
const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
const error = (res: { body: unknown }) => res.body as ErrorBody;

describe('Budgets, goals, emergency fund (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  async function userWithCategories(label: string) {
    const s = await registerAndLogin(ctx, label);
    const account = data<{ id: string }>(
      await s.client
        .post('/api/accounts')
        .send({
          name: 'Conta',
          type: 'CHECKING',
          initialBalance: '10000.00',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
    const categories = data<{ id: string; name: string; type: string }[]>(
      await s.client.get('/api/categories').expect(200),
    );
    const cat = (name: string, type = 'EXPENSE') =>
      categories.find((c) => c.name === name && c.type === type)?.id ?? '';
    const expense = (amount: string, date: string, categoryId?: string) =>
      s.client
        .post('/api/transactions')
        .send({
          type: 'EXPENSE',
          amount,
          date,
          // Sem categoria, uma descrição que não casa com nenhuma outra (nem com palavra-chave)
          // para não ser categorizada automaticamente.
          description: categoryId ? 'Gasto' : 'Avulso',
          accountId: account,
          categoryId,
        })
        .expect(201)
        .then((r) => data<{ id: string }[]>(r)[0].id);
    return { ...s, account, cat, expense };
  }

  describe('orçamentos', () => {
    let s: Awaited<ReturnType<typeof userWithCategories>>;
    let food: string;
    let market: string;

    beforeAll(async () => {
      s = await userWithCategories('budgets');
      food = s.cat('Alimentação');
      market = data<{ id: string }>(
        await s.client
          .post('/api/categories')
          .send({
            name: 'Mercado',
            type: 'EXPENSE',
            icon: 'store',
            color: '#222222',
            parentId: food,
          })
          .expect(201),
      ).id;
    });

    const budgets = async (month: string) =>
      (await s.client.get(`/api/budgets?month=${month}`).expect(200)).body as {
        data: Budget[];
        meta: Record<string, unknown>;
      };
    const notifications = async (client: AuthedClient = s.client) =>
      data<Notification[]>(await client.get('/api/notifications?unread=true').expect(200));

    it('CRUD, gasto com subcategoria, fora do orçamento e sem categoria', async () => {
      const created = data<Budget>(
        await s.client
          .post('/api/budgets')
          .send({ categoryId: food, month: '2025-05', limitAmount: '1000.00' })
          .expect(201),
      );
      expect(created).toMatchObject({
        month: '2025-05',
        spent: '0.00',
        percent: 0,
        level: 'OK',
        limitAmount: '1000.00',
      });

      await s.expense('100.00', '2025-05-03', food);
      await s.expense('150.50', '2025-05-04', market);
      await s.expense('500.00', '2025-05-05', s.cat('Moradia'));
      await s.expense('70.00', '2025-05-06');
      await s.expense('999.00', '2025-06-01', food); // outro mês

      const { data: list, meta } = await budgets('2025-05');
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        spent: '250.50',
        remaining: '749.50',
        percent: 25.1,
        level: 'OK',
      });
      expect(meta).toEqual({
        month: '2025-05',
        totalLimit: '1000.00',
        totalSpent: '250.50',
        remaining: '749.50',
        percent: 25.1,
        unbudgetedSpent: '500.00',
        uncategorizedSpent: '70.00',
      });

      const patched = data<Budget>(
        await s.client
          .patch(`/api/budgets/${created.id}`)
          .send({ limitAmount: '500.00' })
          .expect(200),
      );
      expect(patched).toMatchObject({ percent: 50.1, level: 'ATTENTION', remaining: '249.50' });
      await s.client.patch(`/api/budgets/${created.id}`).send({ limitAmount: '0' }).expect(400);
    });

    it('duplicado 409, sobreposição 400, categoria de receita 400, outro usuário 404', async () => {
      expect(
        error(
          await s.client
            .post('/api/budgets')
            .send({ categoryId: food, month: '2025-05', limitAmount: '10.00' })
            .expect(409),
        ).code,
      ).toBe('BUDGET_ALREADY_EXISTS');
      expect(
        error(
          await s.client
            .post('/api/budgets')
            .send({ categoryId: market, month: '2025-05', limitAmount: '10.00' })
            .expect(400),
        ).code,
      ).toBe('BUDGET_OVERLAP');
      // Sub orçada primeiro bloqueia a raiz.
      await s.client
        .post('/api/budgets')
        .send({ categoryId: market, month: '2025-04', limitAmount: '10.00' })
        .expect(201);
      expect(
        error(
          await s.client
            .post('/api/budgets')
            .send({ categoryId: food, month: '2025-04', limitAmount: '10.00' })
            .expect(400),
        ).code,
      ).toBe('BUDGET_OVERLAP');
      expect(
        error(
          await s.client
            .post('/api/budgets')
            .send({
              categoryId: s.cat('Salário', 'INCOME'),
              month: '2025-05',
              limitAmount: '10.00',
            })
            .expect(400),
        ).code,
      ).toBe('CATEGORY_TYPE_MISMATCH');
      await s.client
        .post('/api/budgets')
        .send({ categoryId: food, month: '2025-13', limitAmount: '10.00' })
        .expect(400);

      const other = await quickUser(ctx, 'budgets-other');
      const budget = (await budgets('2025-05')).data[0];
      expect(
        error(
          await other.client
            .patch(`/api/budgets/${budget.id}`)
            .send({ limitAmount: '1.00' })
            .expect(404),
        ).code,
      ).toBe('BUDGET_NOT_FOUND');
      await other.client.delete(`/api/budgets/${budget.id}`).expect(404);
    });

    it('cópia entre meses e sugestões', async () => {
      const copied = data<{ created: number; skipped: number }>(
        await s.client
          .post('/api/budgets/copy')
          .send({ fromMonth: '2025-05', toMonth: '2025-06' })
          .expect(200),
      );
      expect(copied).toEqual({ created: 1, skipped: 0 });
      expect(
        data<{ created: number; skipped: number }>(
          await s.client
            .post('/api/budgets/copy')
            .send({ fromMonth: '2025-05', toMonth: '2025-06' })
            .expect(200),
        ),
      ).toEqual({ created: 0, skipped: 1 });
      const june = (await budgets('2025-06')).data;
      expect(june[0]).toMatchObject({ limitAmount: '500.00', spent: '999.00', level: 'EXCEEDED' });

      const suggestions = data<
        { category: { name: string }; averageSpent: string; lastMonthSpent: string }[]
      >(await s.client.get('/api/budgets/suggestions?month=2025-06').expect(200));
      expect(suggestions).toEqual([
        {
          category: expect.objectContaining({ name: 'Moradia' }),
          averageSpent: '166.67',
          lastMonthSpent: '500.00',
        },
      ]);
    });

    it('alertas: 40% → 55% → 85% → 105% geram exatamente 3 notificações em ordem, sem duplicar', async () => {
      const a = await userWithCategories('budgets-alerts');
      const leisure = a.cat('Lazer');
      await a.client
        .post('/api/budgets')
        .send({ categoryId: leisure, month: '2025-03', limitAmount: '1000.00' })
        .expect(201);
      await a.expense('400.00', '2025-03-01', leisure);
      expect(await notifications(a.client)).toHaveLength(0);
      await a.expense('150.00', '2025-03-02', leisure);
      await a.expense('300.00', '2025-03-03', leisure);
      const last = await a.expense('200.00', '2025-03-04', leisure);

      let list = (await notifications(a.client)).reverse();
      expect(list.map((n) => [n.type, n.data.threshold])).toEqual([
        ['BUDGET_THRESHOLD', 50],
        ['BUDGET_THRESHOLD', 80],
        ['BUDGET_EXCEEDED', 100],
      ]);
      expect(list[1].title).toBe('Lazer atingiu 80% do orçamento');
      expect(list[2].title).toBe('Orçamento de Lazer excedido');
      expect(list[2].body).toContain('R$ 1.050,00');
      expect(list[2].data).toMatchObject({ month: '2025-03', percent: 105 });

      // Cai abaixo e volta a cruzar: nada novo.
      await a.client.delete(`/api/transactions/${last}`).expect(204);
      await a.expense('250.00', '2025-03-05', leisure);
      await a.client.patch(`/api/transactions/${last}`).send({}).expect(404);
      list = await notifications(a.client);
      expect(list).toHaveLength(3);

      // Notificações: ler uma, depois todas; outro usuário → 404.
      const read = data<Notification>(
        await a.client.post(`/api/notifications/${list[0].id}/read`).expect(200),
      );
      expect(read.readAt).not.toBeNull();
      expect(await notifications(a.client)).toHaveLength(2);
      expect(
        data<{ updated: number }>(await a.client.post('/api/notifications/read-all').expect(200)),
      ).toEqual({ updated: 2 });
      expect(await notifications(a.client)).toHaveLength(0);
      expect(
        data<Notification[]>(await a.client.get('/api/notifications').expect(200)),
      ).toHaveLength(3);
      const other = await quickUser(ctx, 'notif-other');
      expect(
        error(await other.client.post(`/api/notifications/${list[0].id}/read`).expect(404)).code,
      ).toBe('NOTIFICATION_NOT_FOUND');
    });

    it('preferência budgetAlerts desligada → nenhuma notificação', async () => {
      const q = await userWithCategories('budgets-noprefs');
      await q.client
        .patch('/api/users/me')
        .send({ notificationPrefs: { budgetAlerts: false } })
        .expect(200);
      const leisure = q.cat('Lazer');
      await q.client
        .post('/api/budgets')
        .send({ categoryId: leisure, month: '2025-03', limitAmount: '100.00' })
        .expect(201);
      await q.expense('150.00', '2025-03-01', leisure);
      expect(await notifications(q.client)).toHaveLength(0);
      const channelOff = await userWithCategories('budgets-noinapp');
      await channelOff.client
        .patch('/api/users/me')
        .send({ notificationPrefs: { channels: { inApp: false } } })
        .expect(200);
      const cat = channelOff.cat('Lazer');
      await channelOff.client
        .post('/api/budgets')
        .send({ categoryId: cat, month: '2025-03', limitAmount: '100.00' })
        .expect(201);
      await channelOff.expense('150.00', '2025-03-01', cat);
      expect(await notifications(channelOff.client)).toHaveLength(0);
    });
  });

  describe('metas', () => {
    it('CRUD, aportes ±, saldo insuficiente, conclusão automática e volta', async () => {
      const { client } = await quickUser(ctx, 'goals');
      const future = `${Number(TODAY.slice(0, 4)) + 1}-12-31`;
      const goal = data<Goal>(
        await client
          .post('/api/goals')
          .send({
            name: 'Viagem',
            category: 'TRAVEL',
            targetAmount: '1000.00',
            currentAmount: '200.00',
            targetDate: future,
            monthlyContribution: '100.00',
          })
          .expect(201),
      );
      expect(goal).toMatchObject({
        status: 'ACTIVE',
        currentAmount: '200.00',
        remaining: '800.00',
        progress: 20,
        contributionsCount: 1,
      });
      expect(goal.requiredMonthly).toMatch(/^\d+\.\d{2}$/);
      expect(goal.onTrack).toBe(true);

      const add = data<{ goal: Goal; contribution: { amount: string; date: string } }>(
        await client
          .post(`/api/goals/${goal.id}/contributions`)
          .send({ amount: '300.00', date: TODAY, note: 'Bônus' })
          .expect(201),
      );
      expect(add.goal.currentAmount).toBe('500.00');
      expect(add.contribution).toMatchObject({ amount: '300.00', date: TODAY });

      const insufficient = await client
        .post(`/api/goals/${goal.id}/contributions`)
        .send({ amount: '-600.00', date: TODAY })
        .expect(400);
      expect(error(insufficient).code).toBe('GOAL_INSUFFICIENT_BALANCE');
      expect(data<Goal>(await client.get(`/api/goals/${goal.id}`)).currentAmount).toBe('500.00');
      await client
        .post(`/api/goals/${goal.id}/contributions`)
        .send({ amount: '0', date: TODAY })
        .expect(400);
      await client
        .post(`/api/goals/${goal.id}/contributions`)
        .send({ amount: '10.00', date: '2999-01-01' })
        .expect(400);

      const withdraw = data<{ goal: Goal }>(
        await client
          .post(`/api/goals/${goal.id}/contributions`)
          .send({ amount: '-100.00', date: TODAY })
          .expect(201),
      );
      expect(withdraw.goal.currentAmount).toBe('400.00');

      const complete = data<{ goal: Goal; contribution: { id: string } }>(
        await client
          .post(`/api/goals/${goal.id}/contributions`)
          .send({ amount: '600.00', date: TODAY })
          .expect(201),
      );
      expect(complete.goal).toMatchObject({
        status: 'COMPLETED',
        progress: 100,
        remaining: '0.00',
      });
      const notes = data<Notification[]>(await client.get('/api/notifications').expect(200));
      expect(notes.map((n) => n.type)).toEqual(['GOAL_COMPLETED']);

      const reverted = data<Goal>(
        await client
          .delete(`/api/goals/${goal.id}/contributions/${complete.contribution.id}`)
          .expect(200),
      );
      expect(reverted).toMatchObject({ status: 'ACTIVE', currentAmount: '400.00' });

      const detail = data<
        Goal & {
          contributions: { note: string | null }[];
          series: { month: string; saved: string }[];
        }
      >(await client.get(`/api/goals/${goal.id}`).expect(200));
      expect(detail.contributions.map((c) => c.note)).toContain('Valor inicial');
      expect(detail.contributions).toHaveLength(3); // o aporte que concluiu foi removido
      expect(detail.series).toHaveLength(12);
      expect(detail.series.at(-1)).toEqual({ month: yearMonthOf(TODAY), saved: '400.00' });

      await client.patch(`/api/goals/${goal.id}`).send({ status: 'PAUSED' }).expect(200);
      await client.patch(`/api/goals/${goal.id}`).send({ targetDate: '2020-01-01' }).expect(400);
      await client.patch(`/api/goals/${goal.id}`).send({ status: 'ARCHIVED' }).expect(200);
      const list = (await client.get('/api/goals').expect(200)).body as {
        data: Goal[];
        meta: { count: number };
      };
      expect(list.meta.count).toBe(0);
      const all = (await client.get('/api/goals?status=ALL').expect(200)).body as {
        data: Goal[];
        meta: Record<string, unknown>;
      };
      expect(all.meta).toEqual({ totalTarget: '1000.00', totalSaved: '400.00', count: 1 });

      const other = await quickUser(ctx, 'goals-other');
      for (const res of [
        await other.client.get(`/api/goals/${goal.id}`),
        await other.client.patch(`/api/goals/${goal.id}`).send({ name: 'x' }),
        await other.client
          .post(`/api/goals/${goal.id}/contributions`)
          .send({ amount: '1.00', date: TODAY }),
        await other.client.delete(`/api/goals/${goal.id}`),
      ]) {
        expect(res.status).toBe(404);
        expect(error(res).code).toBe('GOAL_NOT_FOUND');
      }

      await client.delete(`/api/goals/${goal.id}`).expect(204);
      await client.get(`/api/goals/${goal.id}`).expect(404);
      await client
        .post('/api/goals')
        .send({ name: 'X', category: 'OTHER', targetAmount: '10.00', targetDate: '2020-01-01' })
        .expect(400);
    });

    it('meta criada no onboarding funciona com aportes', async () => {
      const s = await registerAndLogin(ctx, 'goals-onboarding');
      await s.client
        .post('/api/users/me/onboarding')
        .send({
          monthlyIncome: '5000.00',
          monthlyExpenses: '3000.00',
          topExpenseCategoryIds: [],
          cashBalance: '1000.00',
          goal: { category: 'EMERGENCY', name: 'Reserva' },
          emergencyMonths: 3,
        })
        .expect(201);
      const [goal] = ((await s.client.get('/api/goals').expect(200)).body as { data: Goal[] }).data;
      const res = data<{ goal: Goal }>(
        await s.client
          .post(`/api/goals/${goal.id}/contributions`)
          .send({ amount: '9000.00', date: TODAY })
          .expect(201),
      );
      expect(res.goal).toMatchObject({ status: 'COMPLETED', currentAmount: '9000.00' });
    });
  });

  describe('reserva de emergência', () => {
    it('null → manual → ajuste → vinculada → alvo customizado, coerente com o dashboard', async () => {
      const s = await userWithCategories('emergency');
      expect(data<unknown>(await s.client.get('/api/emergency-fund').expect(200))).toBeNull();
      expect(
        error(
          await s.client.post('/api/emergency-fund/adjust').send({ amount: '10.00' }).expect(404),
        ).code,
      ).toBe('EMERGENCY_FUND_NOT_FOUND');

      // Mês completo anterior com receita e despesa → sugestões.
      const lastMonth = monthStart(addMonthsYm(yearMonthOf(TODAY), -1));
      await s.client
        .post('/api/transactions')
        .send({
          type: 'INCOME',
          amount: '8000.00',
          date: lastMonth,
          description: 'Salário',
          accountId: s.account,
        })
        .expect(201);
      await s.expense('3000.00', lastMonth, s.cat('Moradia'));

      const manual = data<Record<string, unknown>>(
        await s.client
          .put('/api/emergency-fund')
          .send({
            monthlyCost: '5000.00',
            targetMonths: 6,
            currentAmount: '3000.00',
            monthlyContribution: '1000.00',
          })
          .expect(200),
      );
      expect(manual).toMatchObject({
        monthlyCost: '5000.00',
        targetAmount: '30000.00',
        customTarget: false,
        mode: 'MANUAL',
        linkedAccount: null,
        currentAmount: '3000.00',
        remaining: '27000.00',
        progress: 10,
        coverageMonths: 0.6,
        monthsToTarget: 27,
        suggestions: { averageMonthlyExpense: '3000.00', averageMonthlySurplus: '5000.00' },
      });

      expect(
        data<{ currentAmount: string }>(
          await s.client.post('/api/emergency-fund/adjust').send({ amount: '2000.00' }).expect(200),
        ).currentAmount,
      ).toBe('5000.00');
      expect(
        error(
          await s.client
            .post('/api/emergency-fund/adjust')
            .send({ amount: '-6000.00' })
            .expect(400),
        ).code,
      ).toBe('VALIDATION_ERROR');
      await s.client.post('/api/emergency-fund/adjust').send({ amount: '0' }).expect(400);

      const linked = data<Record<string, unknown>>(
        await s.client
          .put('/api/emergency-fund')
          .send({
            monthlyCost: '5000.00',
            targetMonths: 6,
            linkedAccountId: s.account,
            targetAmount: '25000.00',
          })
          .expect(200),
      );
      expect(linked).toMatchObject({
        mode: 'LINKED',
        customTarget: true,
        targetAmount: '25000.00',
        currentAmount: '15000.00', // 10000 inicial + 8000 − 3000
        linkedAccount: expect.objectContaining({ id: s.account, currentBalance: '15000.00' }),
        coverageMonths: 3,
        monthsToTarget: null,
      });
      expect(
        error(
          await s.client.post('/api/emergency-fund/adjust').send({ amount: '10.00' }).expect(400),
        ).code,
      ).toBe('EMERGENCY_FUND_LINKED');

      // O saldo acompanha a conta.
      await s.expense('500.00', TODAY);
      expect(
        data<{ currentAmount: string }>(await s.client.get('/api/emergency-fund')).currentAmount,
      ).toBe('14500.00');
      const dashboard = data<{
        emergencyFund: { current: string; target: string; targetMonths: number };
      }>(await s.client.get('/api/dashboard').expect(200));
      expect(dashboard.emergencyFund).toMatchObject({
        current: '14500.00',
        target: '25000.00',
        targetMonths: 6,
      });

      const other = await quickUser(ctx, 'emergency-other');
      expect(
        error(
          await other.client
            .put('/api/emergency-fund')
            .send({ monthlyCost: '1.00', targetMonths: 1, linkedAccountId: s.account })
            .expect(404),
        ).code,
      ).toBe('ACCOUNT_NOT_FOUND');
      await s.client
        .put('/api/emergency-fund')
        .send({ monthlyCost: '0', targetMonths: 6 })
        .expect(400);
      await s.client
        .put('/api/emergency-fund')
        .send({ monthlyCost: '10.00', targetMonths: 25 })
        .expect(400);
    });
  });
});
