import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addDays, todayIn } from '../src/common/utils/date-only.js';
import { type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface OnboardingBody {
  data: {
    user: { onboardingCompleted: boolean };
    summary: Record<string, string | number | null>;
  };
}

describe('Onboarding (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  const targetDate = addDays(todayIn('America/Sao_Paulo'), 400);

  it('fluxo completo cria entidades, devolve o resumo e bloqueia a repetição', async () => {
    const s = await registerAndLogin(ctx, 'onboarding');
    const categories = (
      (await s.client.get('/api/categories?type=EXPENSE').expect(200)).body as {
        data: { id: string; name: string }[];
      }
    ).data;
    const top = categories
      .filter((c) => ['Moradia', 'Alimentação'].includes(c.name))
      .map((c) => c.id);

    // Nome já usado → sufixo.
    await s.client
      .post('/api/accounts')
      .send({
        name: 'Nubank',
        type: 'CHECKING',
        initialBalance: '0',
        color: '#000000',
        icon: 'wallet',
      })
      .expect(201);

    const res = await s.client
      .post('/api/users/me/onboarding')
      .send({
        monthlyIncome: '10000.00',
        monthlyExpenses: '6000.00',
        topExpenseCategoryIds: top,
        cashBalance: '18000.00',
        mainAccountName: 'Nubank',
        institution: 'Nu Pagamentos',
        investments: { total: '25000.00' },
        debts: { outstanding: '8000.00', monthlyPayment: '650.00' },
        goal: { category: 'TRAVEL', name: 'Japão', targetAmount: '30000.00', targetDate },
        emergencyMonths: 6,
      })
      .expect(201);

    const body = res.body as OnboardingBody;
    expect(body.data.user.onboardingCompleted).toBe(true);
    expect(body.data.summary).toMatchObject({
      netWorth: '35000.00',
      cash: '18000.00',
      investments: '25000.00',
      debts: '8000.00',
      savingsRate: 40,
      monthlySurplus: '4000.00',
      emergencyTarget: '36000.00',
      emergencyCoverageMonths: 3,
    });
    expect(body.data.summary.goalMonthlyContribution).toMatch(/^\d+\.\d{2}$/);

    const accounts = await ctx.prisma.account.findMany({
      where: { userId: s.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(accounts.map((a) => [a.name, a.type, a.currentBalance.toFixed(2)])).toEqual([
      ['Nubank', 'CHECKING', '0.00'],
      ['Nubank (2)', 'CHECKING', '18000.00'],
      ['Investimentos', 'INVESTMENT', '25000.00'],
    ]);
    const liability = await ctx.prisma.liability.findFirstOrThrow({ where: { userId: s.userId } });
    expect([
      liability.type,
      liability.outstandingBalance.toFixed(2),
      liability.monthlyPayment?.toFixed(2),
    ]).toEqual(['DEBT', '8000.00', '650.00']);
    const fund = await ctx.prisma.emergencyFund.findUniqueOrThrow({ where: { userId: s.userId } });
    expect([
      fund.monthlyCost.toFixed(2),
      fund.targetMonths,
      fund.targetAmount.toFixed(2),
      fund.currentAmount.toFixed(2),
    ]).toEqual(['6000.00', 6, '36000.00', '0.00']);
    const goal = await ctx.prisma.goal.findFirstOrThrow({ where: { userId: s.userId } });
    expect(goal).toMatchObject({
      name: 'Japão',
      category: 'TRAVEL',
      priority: 'HIGH',
      status: 'ACTIVE',
    });
    expect(goal.monthlyContribution?.toFixed(2)).toBe(body.data.summary.goalMonthlyContribution);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: s.userId } });
    expect(user.onboardingAnswers).toMatchObject({
      monthlyIncome: '10000.00',
      monthlyExpenses: '6000.00',
      topExpenseCategoryIds: top,
    });

    const again = await s.client
      .post('/api/users/me/onboarding')
      .send({
        monthlyIncome: '1',
        monthlyExpenses: '1',
        topExpenseCategoryIds: [],
        cashBalance: '0',
        emergencyMonths: 3,
      })
      .expect(409);
    expect((again.body as ErrorBody).code).toBe('ONBOARDING_ALREADY_COMPLETED');
    await s.client.post('/api/users/me/onboarding/skip').expect(409);
  });

  it('meta EMERGENCY sem valor herda o alvo da reserva; campos opcionais nulos', async () => {
    const { user, client } = await quickUser(ctx, 'onboarding-min');
    const res = await client
      .post('/api/users/me/onboarding')
      .send({
        monthlyIncome: '0',
        monthlyExpenses: '2500.50',
        topExpenseCategoryIds: [],
        cashBalance: '-300.00',
        investments: null,
        debts: null,
        goal: { category: 'EMERGENCY', name: 'Reserva' },
        emergencyMonths: 3,
      })
      .expect(201);
    expect((res.body as OnboardingBody).data.summary).toMatchObject({
      savingsRate: null,
      emergencyTarget: '7501.50',
      emergencyCoverageMonths: 0,
      goalMonthlyContribution: null,
      netWorth: '-300.00',
    });
    const goal = await ctx.prisma.goal.findFirstOrThrow({ where: { userId: user.id } });
    expect(goal.targetAmount.toFixed(2)).toBe('7501.50');
    expect(await ctx.prisma.account.count({ where: { userId: user.id } })).toBe(1);
  });

  it('skip marca como concluído', async () => {
    const { client } = await quickUser(ctx, 'onboarding-skip');
    const res = await client.post('/api/users/me/onboarding/skip').expect(200);
    expect((res.body as { data: { onboardingCompleted: boolean } }).data.onboardingCompleted).toBe(
      true,
    );
    await client.post('/api/users/me/onboarding/skip').expect(409);
  });

  it('validações: categoria alheia/receita, valores, meses, data da meta', async () => {
    const other = await registerAndLogin(ctx, 'onboarding-foreign');
    const foreign = (
      (await other.client.get('/api/categories?type=EXPENSE').expect(200)).body as {
        data: { id: string }[];
      }
    ).data[0].id;
    const s = await registerAndLogin(ctx, 'onboarding-invalid');
    const income = (
      (await s.client.get('/api/categories?type=INCOME').expect(200)).body as {
        data: { id: string }[];
      }
    ).data[0].id;
    const base = {
      monthlyIncome: '1000.00',
      monthlyExpenses: '500.00',
      topExpenseCategoryIds: [],
      cashBalance: '0',
      emergencyMonths: 6,
    };
    const expectField = async (body: Record<string, unknown>, field: string) => {
      const res = await s.client
        .post('/api/users/me/onboarding')
        .send({ ...base, ...body })
        .expect(400);
      expect((res.body as ErrorBody).details?.map((d) => d.field)).toContain(field);
    };
    await expectField({ topExpenseCategoryIds: [foreign] }, 'topExpenseCategoryIds');
    await expectField({ topExpenseCategoryIds: [income] }, 'topExpenseCategoryIds');
    await expectField({ monthlyIncome: '-1.00' }, 'monthlyIncome');
    await expectField({ monthlyExpenses: 500 }, 'monthlyExpenses');
    await expectField({ emergencyMonths: 25 }, 'emergencyMonths');
    await expectField(
      { goal: { category: 'TRAVEL', name: 'X', targetDate: '2020-01-01' } },
      'goal.targetDate',
    );
    await expectField({ goal: { category: 'NOPE', name: 'X' } }, 'goal.category');
    // Nada foi criado nem marcado como concluído.
    expect((await s.client.get('/api/users/me').expect(200)).body).toMatchObject({
      data: { onboardingCompleted: false },
    });
    expect(await ctx.prisma.account.count({ where: { userId: s.userId } })).toBe(0);
  });
});
