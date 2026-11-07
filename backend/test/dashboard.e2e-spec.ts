import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addDays, todayIn, toDbDate } from '../src/common/utils/date-only.js';
import { SnapshotService } from '../src/modules/dashboard/snapshot.service.js';
import { type AuthedClient, type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface Dashboard {
  month: string;
  netWorth: {
    current: string;
    assets: string;
    liabilities: string;
    changeAmount12m: string;
    change12m: number | null;
  };
  cash: { available: string };
  investments: { total: string };
  flow: Record<string, string>;
  emergencyFund: {
    current: string;
    target: string;
    targetMonths: number;
    coverageMonths: number | null;
    progress: number | null;
  } | null;
  commitments: {
    next30Days: string;
    pendingCount: number;
    overdueCount: number;
    overdueAmount: string;
  };
  series: {
    netWorthMethod: string;
    netWorth: { month: string; value: string }[];
    cashflow: { month: string; income: string; expense: string }[];
    spendingByCategory: {
      categoryId: string | null;
      name: string;
      amount: string;
      share: number;
    }[];
  };
  goals: { name: string; progress: number; monthlyContributionNeeded: string | null }[];
  upcoming: { description: string; date: string }[];
  recent: { description: string }[];
  insights: { key: string; tone: string; message: string; value: number | null }[];
}

const TODAY = todayIn('America/Sao_Paulo');

describe('Dashboard (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let userId: string;

  const dashboard = async (query = '') =>
    ((await client.get(`/api/dashboard${query}`).expect(200)).body as { data: Dashboard }).data;

  beforeAll(async () => {
    ctx = await createTestApp();
    const s = await registerAndLogin(ctx, 'dashboard');
    client = s.client;
    userId = s.userId;

    await client
      .post('/api/users/me/onboarding')
      .send({
        monthlyIncome: '10000.00',
        monthlyExpenses: '6000.00',
        topExpenseCategoryIds: [],
        cashBalance: '18000.00',
        investments: { total: '25000.00' },
        debts: { outstanding: '8000.00', monthlyPayment: '650.00' },
        goal: {
          category: 'TRAVEL',
          name: 'Japão',
          targetAmount: '30000.00',
          targetDate: addDays(TODAY, 365),
        },
        emergencyMonths: 6,
      })
      .expect(201);

    const accounts = (
      (await client.get('/api/accounts').expect(200)).body as {
        data: { id: string; type: string }[];
      }
    ).data;
    const main = accounts.find((a) => a.type === 'CHECKING')?.id ?? '';
    const invest = accounts.find((a) => a.type === 'INVESTMENT')?.id ?? '';
    const categories = (
      (await client.get('/api/categories').expect(200)).body as {
        data: { id: string; name: string; type: string }[];
      }
    ).data;
    const cat = (name: string, type = 'EXPENSE') =>
      categories.find((c) => c.name === name && c.type === type)?.id;
    const market = (
      (
        await client
          .post('/api/categories')
          .send({
            name: 'Mercado',
            type: 'EXPENSE',
            icon: 'store',
            color: '#111111',
            parentId: cat('Alimentação'),
          })
          .expect(201)
      ).body as { data: { id: string } }
    ).data.id;

    const tx = (
      type: 'INCOME' | 'EXPENSE',
      amount: string,
      date: string,
      categoryId?: string,
      extra: Record<string, unknown> = {},
    ) =>
      client
        .post('/api/transactions')
        .send({
          type,
          amount,
          date,
          // Sem categoria, descrição distinta para não herdar a categoria por histórico.
          description: categoryId ? `${type} ${date}` : `Avulso ${date}`,
          accountId: main,
          categoryId,
          ...extra,
        })
        .expect(201);

    await tx('INCOME', '10000.00', '2026-04-10', cat('Salário', 'INCOME'));
    await tx('EXPENSE', '3000.00', '2026-04-15', cat('Moradia'));
    await tx('INCOME', '10000.00', '2026-05-10', cat('Salário', 'INCOME'));
    await tx('EXPENSE', '4000.00', '2026-05-15', cat('Moradia'));
    await tx('EXPENSE', '1000.00', '2026-05-20', market);
    await tx('INCOME', '10000.00', '2026-06-10', cat('Salário', 'INCOME'));
    await tx('EXPENSE', '3000.00', '2026-06-15', cat('Moradia'));
    await tx('EXPENSE', '500.00', '2026-06-18', market);
    await tx('EXPENSE', '300.00', '2026-06-19', cat('Alimentação'));
    await tx('EXPENSE', '200.00', '2026-06-25');
    await tx('EXPENSE', '400.00', '2026-06-28', cat('Lazer'), { status: 'PENDING' });
    await tx('EXPENSE', '140.00', addDays(TODAY, -3), undefined, {
      status: 'PENDING',
      description: 'Boleto atrasado',
    });
    await tx('EXPENSE', '250.00', addDays(TODAY, 5), undefined, { description: 'Boleto futuro' });
    await client
      .post('/api/transactions/transfers')
      .send({ fromAccountId: main, toAccountId: invest, amount: '1000.00', date: '2026-06-05' })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('fluxo do mês, mês anterior, cashflow com zeros e rollup por categoria raiz', async () => {
    const d = await dashboard('?month=2026-06');
    expect(d.month).toBe('2026-06');
    expect(d.flow).toEqual({
      income: '10000.00',
      expense: '4400.00',
      net: '5600.00',
      pendingIncome: '0.00',
      pendingExpense: '400.00',
      previousIncome: '10000.00',
      previousExpense: '5000.00',
    });
    expect(d.series.cashflow).toEqual([
      { month: '2026-01', income: '0.00', expense: '0.00' },
      { month: '2026-02', income: '0.00', expense: '0.00' },
      { month: '2026-03', income: '0.00', expense: '0.00' },
      { month: '2026-04', income: '10000.00', expense: '3000.00' },
      { month: '2026-05', income: '10000.00', expense: '5000.00' },
      { month: '2026-06', income: '10000.00', expense: '4400.00' },
    ]);
    expect(d.series.spendingByCategory.map((c) => [c.name, c.amount, c.share])).toEqual([
      ['Moradia', '3000.00', 68.2],
      ['Alimentação', '800.00', 18.2], // Mercado (subcategoria) somado à raiz
      ['Lazer', '400.00', 9.1],
      ['Sem categoria', '200.00', 4.5],
    ]);
    expect(d.series.spendingByCategory[3].categoryId).toBeNull();
  });

  it('patrimônio: composição e série reconstruída (transferência neutra)', async () => {
    const d = await dashboard('?month=2026-06');
    // 18000 caixa + 25000 invest − 8000 dívidas + (7000 + 5000 + 6000) de fluxo CLEARED.
    expect(d.netWorth).toMatchObject({
      current: '53000.00',
      assets: '61000.00',
      liabilities: '8000.00',
    });
    expect(d.cash.available).toBe('35000.00'); // 18000 + 18000 de fluxo − 1000 transferidos (pendentes não contam)
    expect(d.investments.total).toBe('26000.00');
    const points = Object.fromEntries(d.series.netWorth.map((p) => [p.month, p.value]));
    expect(d.series.netWorth).toHaveLength(12);
    expect(d.series.netWorth[0].month).toBe('2025-07');
    expect(points).toMatchObject({
      '2026-03': '35000.00',
      '2026-04': '42000.00',
      '2026-05': '47000.00',
      '2026-06': '53000.00',
    });
    expect(d.netWorth.changeAmount12m).toBe('18000.00');
    expect(d.netWorth.change12m).toBe(51.4); // 18000 ÷ 35000
    expect(d.series.netWorthMethod).toBe('reconstructed');

    const current = await dashboard();
    expect(current.month).toBe(TODAY.slice(0, 7));
    expect(current.series.netWorth.at(-1)?.value).toBe(current.netWorth.current);
  });

  it('reserva, compromissos, próximos, recentes, metas e insights', async () => {
    const d = await dashboard('?month=2026-06');
    expect(d.emergencyFund).toEqual({
      current: '0.00',
      target: '36000.00',
      targetMonths: 6,
      coverageMonths: 0,
      progress: 0,
    });
    expect(d.commitments).toEqual({
      next30Days: '900.00', // 250 pendente + 650 de parcela de dívida
      pendingCount: 1,
      overdueCount: 2,
      overdueAmount: '540.00',
    });
    expect(d.upcoming.map((t) => t.description)).toEqual(['Boleto atrasado', 'Boleto futuro']);
    expect(d.recent).toHaveLength(5);
    expect(d.recent.map((t) => t.description)).not.toContain('Boleto futuro');
    expect(d.goals).toHaveLength(1);
    expect(d.goals[0]).toMatchObject({ name: 'Japão', progress: 0 });
    expect(d.goals[0].monthlyContributionNeeded).toMatch(/^\d+\.\d{2}$/);

    expect(d.insights.map((i) => i.key)).toEqual([
      'SPENDING_CHANGE',
      'SAVINGS_RATE',
      'EMERGENCY_COVERAGE',
      'TOP_CATEGORY',
      'OVERDUE',
    ]);
    expect(d.insights[0]).toMatchObject({
      tone: 'positive',
      message: 'Você gastou 12% menos que no mês anterior.',
    });
    expect(d.insights[1]).toMatchObject({
      tone: 'positive',
      message: 'Sua taxa de poupança está em 56%.',
    });
    // Reserva criada no onboarding ainda sem dinheiro separado: fala do saldo disponível.
    expect(d.insights[2].tone).toBe('neutral');
    expect(d.insights[2].message).toMatch(/^Você ainda não separou sua reserva/);
    expect(d.insights[3].message).toBe(
      'Sua maior categoria de gastos foi Moradia (68,2% das despesas).',
    );
    expect(d.insights[4].message).toBe('Você tem 2 lançamentos vencidos somando R$ 540,00.');

    // Mês sem mês anterior com dados: sem SPENDING_CHANGE.
    const april = await dashboard('?month=2026-04');
    expect(april.insights.map((i) => i.key)).not.toContain('SPENDING_CHANGE');
  });

  it('snapshots: job grava o do dia e a série prefere snapshots de fim de mês', async () => {
    const written = await ctx.app.get(SnapshotService).run(new Date(), [userId]);
    expect(written).toBe(1);
    const snapshot = await ctx.prisma.financialSnapshot.findUniqueOrThrow({
      where: { userId_date: { userId, date: toDbDate(TODAY) } },
    });
    expect(snapshot.netWorth.toFixed(2)).toBe('53000.00');
    expect(snapshot.totalLiabilities.toFixed(2)).toBe('8000.00');
    await ctx.app.get(SnapshotService).run(new Date(), [userId]); // idempotente
    expect(await ctx.prisma.financialSnapshot.count({ where: { userId } })).toBe(1);

    await ctx.prisma.financialSnapshot.create({
      data: {
        userId,
        date: toDbDate('2026-04-30'),
        netWorth: '40500.00',
        totalAssets: '0',
        totalLiabilities: '0',
        cash: '0',
        investments: '0',
        emergencyFund: '0',
        income: '0',
        expenses: '0',
      },
    });
    const d = await dashboard('?month=2026-06');
    expect(d.series.netWorthMethod).toBe('snapshots');
    expect(d.series.netWorth.find((p) => p.month === '2026-04')?.value).toBe('40500.00');
    expect(d.series.netWorth.find((p) => p.month === '2026-05')?.value).toBe('47000.00');
  });

  it('valida o parâmetro month', async () => {
    for (const month of ['2026-13', '2026-1', 'junho', '2026-00']) {
      const res = await client.get(`/api/dashboard?month=${month}`).expect(400);
      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    }
  });

  it('usuário sem dados: zeros e listas vazias', async () => {
    const { client: empty } = await quickUser(ctx, 'dashboard-empty');
    const d = ((await empty.get('/api/dashboard').expect(200)).body as { data: Dashboard }).data;
    expect(d.netWorth).toEqual({
      current: '0.00',
      assets: '0.00',
      liabilities: '0.00',
      changeAmount12m: '0.00',
      change12m: null,
    });
    expect(d.flow.income).toBe('0.00');
    expect(d.emergencyFund).toBeNull();
    expect(d.commitments).toEqual({
      next30Days: '0.00',
      pendingCount: 0,
      overdueCount: 0,
      overdueAmount: '0.00',
    });
    expect(d.series.netWorth).toHaveLength(12);
    expect(d.series.netWorth.every((p) => p.value === '0.00')).toBe(true);
    expect(d.series.cashflow).toHaveLength(6);
    expect(d.series.spendingByCategory).toEqual([]);
    expect(d).toMatchObject({ goals: [], upcoming: [], recent: [], insights: [] });
  });
});
