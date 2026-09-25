import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addMonthsYm, monthStart, todayIn, yearMonthOf } from '../src/common/utils/date-only.js';
import { type AuthedClient, type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface Investment {
  id: string;
  ticker: string | null;
  quantity: string | null;
  averagePrice: string | null;
  investedAmount: string;
  currentValue: string;
  income: string;
  realizedGain: string;
  profit: string;
  profitPercent: number | null;
  allocationPercent: number;
  lastValuationAt: string | null;
  transactions?: { id: string; type: string; account: { id: string } | null }[];
  series?: { month: string; value: string; invested: string }[];
}

const TODAY = todayIn('America/Sao_Paulo');
const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
const error = (res: { body: unknown }) => res.body as ErrorBody;

describe('Investimentos, bens, dívidas, patrimônio e planejamento (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let account: string;
  let selic: string;
  let petr: string;

  const balance = async () =>
    data<{ currentBalance: string }>(await client.get(`/api/accounts/${account}`).expect(200))
      .currentBalance;
  const investment = async (id: string) =>
    data<Investment>(await client.get(`/api/investments/${id}`).expect(200));
  const addTx = (id: string, body: Record<string, unknown>) =>
    client.post(`/api/investments/${id}/transactions`).send(body);

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ client } = await registerAndLogin(ctx, 'investments'));
    account = data<{ id: string }>(
      await client
        .post('/api/accounts')
        .send({
          name: 'Corrente',
          type: 'CHECKING',
          initialBalance: '10000.00',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('investimentos', () => {
    it('cadastro com e sem conta de origem', async () => {
      const funded = data<Investment>(
        await client
          .post('/api/investments')
          .send({
            name: 'Tesouro Selic',
            type: 'TREASURY',
            investedAmount: '2000.00',
            appliedAt: '2026-01-10',
            liquidity: 'DAILY',
            fundingAccountId: account,
          })
          .expect(201),
      );
      selic = funded.id;
      expect(funded).toMatchObject({
        investedAmount: '2000.00',
        currentValue: '2000.00',
        quantity: null,
        profit: '0.00',
      });
      expect(await balance()).toBe('8000.00');
      const cash = (await client.get('/api/transactions?q=aplicacao').expect(200)).body as {
        data: { description: string; type: string; amount: string }[];
      };
      expect(cash.data).toEqual([
        expect.objectContaining({
          description: 'Aplicação: Tesouro Selic',
          type: 'TRANSFER',
          amount: '2000.00',
        }),
      ]);

      const holding = data<Investment>(
        await client
          .post('/api/investments')
          .send({
            name: 'Petrobras',
            ticker: 'petr4',
            type: 'STOCKS',
            quantity: '100',
            averagePrice: '30',
            currentValue: '3500.00',
            appliedAt: '2026-02-01',
            liquidity: 'D_PLUS_X',
            liquidityDays: 2,
          })
          .expect(201),
      );
      petr = holding.id;
      expect(holding).toMatchObject({
        ticker: 'PETR4',
        quantity: '100.00000000',
        averagePrice: '30.00000000',
        investedAmount: '3000.00',
        currentValue: '3500.00',
        profit: '500.00',
        profitPercent: 16.7,
      });
      expect(await balance()).toBe('8000.00');

      await client
        .post('/api/investments')
        .send({ name: 'X', type: 'CDB', appliedAt: '2026-01-01', liquidity: 'DAILY' })
        .expect(400);
      await client
        .post('/api/investments')
        .send({
          name: 'X',
          type: 'CDB',
          investedAmount: '1.00',
          appliedAt: '2999-01-01',
          liquidity: 'DAILY',
        })
        .expect(400);
    });

    it('BUY / SELL / DIVIDEND / FEE / VALUATION com números de lucro', async () => {
      await addTx(petr, {
        type: 'BUY',
        amount: '1600.00',
        quantity: '50',
        price: '32',
        date: '2026-03-01',
        accountId: account,
      }).expect(201);
      let p = await investment(petr);
      expect(p).toMatchObject({
        quantity: '150.00000000',
        averagePrice: '30.66666667',
        investedAmount: '4600.00',
        currentValue: '5100.00',
      });
      expect(await balance()).toBe('6400.00');

      await addTx(petr, {
        type: 'SELL',
        amount: '2700.00',
        quantity: '75',
        date: '2026-04-01',
        accountId: account,
      }).expect(201);
      p = await investment(petr);
      expect(p).toMatchObject({
        quantity: '75.00000000',
        investedAmount: '2300.00',
        realizedGain: '400.00',
        currentValue: '2400.00',
      });
      expect(await balance()).toBe('9100.00');

      await addTx(petr, {
        type: 'DIVIDEND',
        amount: '120.00',
        date: '2026-04-15',
        accountId: account,
      }).expect(201);
      await addTx(petr, { type: 'FEE', amount: '10.00', date: '2026-04-16' }).expect(201);
      p = data<Investment>(
        await addTx(petr, { type: 'VALUATION', amount: '2600.00', date: '2026-04-30' }).expect(201),
      );
      expect(p).toMatchObject({
        income: '110.00',
        currentValue: '2600.00',
        lastValuationAt: '2026-04-30',
        profit: '810.00',
        profitPercent: 35.2,
      });
      expect(await balance()).toBe('9220.00');
      const dividends = (await client.get('/api/transactions?type=INCOME').expect(200)).body as {
        data: { description: string; category: { name: string } | null }[];
      };
      expect(dividends.data[0]).toMatchObject({
        description: 'Dividendos: Petrobras',
        category: { name: 'Rendimentos' },
      });

      const tooMuch = await addTx(petr, {
        type: 'SELL',
        amount: '10.00',
        quantity: '100',
        date: TODAY,
        accountId: account,
      }).expect(400);
      expect(error(tooMuch).code).toBe('INVESTMENT_INSUFFICIENT');
      expect(await balance()).toBe('9220.00');
      await addTx(petr, {
        type: 'VALUATION',
        amount: '1.00',
        date: TODAY,
        accountId: account,
      }).expect(400);
      await addTx(petr, { type: 'BUY', amount: '1.00', date: '2999-01-01' }).expect(400);
    });

    it('excluir movimentação desfaz o caixa e recalcula; lançamento vinculado é protegido', async () => {
      const detail = await investment(petr);
      const sell = detail.transactions?.find((t) => t.type === 'SELL');
      const linked = await ctx.prisma.investmentTransaction.findUniqueOrThrow({
        where: { id: sell?.id ?? '' },
      });
      expect(
        error(await client.delete(`/api/transactions/${linked.transactionId}`).expect(400)).code,
      ).toBe('LINKED_TRANSACTION');
      await client
        .patch(`/api/transactions/${linked.transactionId}`)
        .send({ amount: '1.00' })
        .expect(400);

      const after = data<Investment>(
        await client.delete(`/api/investments/${petr}/transactions/${sell?.id}`).expect(200),
      );
      expect(after).toMatchObject({
        quantity: '150.00000000',
        investedAmount: '4600.00',
        realizedGain: '0.00',
        currentValue: '2600.00',
      });
      expect(await balance()).toBe('6520.00');
      expect(
        await ctx.prisma.transaction.count({ where: { id: linked.transactionId ?? '' } }),
      ).toBe(0);
      await client.delete(`/api/investments/${petr}/transactions/${sell?.id}`).expect(404);
    });

    it('listagem com alocação, séries e busca', async () => {
      const list = (await client.get('/api/investments').expect(200)).body as {
        data: Investment[];
        meta: Record<string, unknown>;
      };
      expect(list.data.map((i) => i.currentValue)).toEqual(['2600.00', '2000.00']);
      expect(list.data.map((i) => i.id)).toEqual([petr, selic]);
      expect(list.data.map((i) => i.allocationPercent)).toEqual([56.5, 43.5]);
      expect(list.meta).toMatchObject({
        totalInvested: '6600.00',
        totalCurrent: '4600.00',
        totalIncome: '110.00',
        count: 2,
        unallocatedBrokerCash: '0.00',
      });
      expect(list.meta.byClass).toEqual([
        { type: 'STOCKS', current: '2600.00', invested: '4600.00', share: 56.5 },
        { type: 'TREASURY', current: '2000.00', invested: '2000.00', share: 43.5 },
      ]);

      const detail = await investment(petr);
      expect(detail.series).toHaveLength(12);
      const series = data<{ month: string; value: string; contributions: string }[]>(
        await client.get('/api/investments/series?months=12').expect(200),
      );
      expect(series).toHaveLength(12);
      expect(series.at(-1)?.value).toBe('4600.00');
      const april = series.find((p) => p.month === '2026-04');
      if (april) expect(april).toMatchObject({ value: '4600.00', contributions: '0.00' });

      const search = data<{ investments: Investment[] }>(
        await client.get('/api/search?q=petr').expect(200),
      );
      expect(search.investments.map((i) => i.ticker)).toEqual(['PETR4']);

      const dashboard = data<{
        investments: { total: string };
        series: { investments: { value: string }[] };
      }>(await client.get('/api/dashboard').expect(200));
      expect(dashboard.investments.total).toBe('4600.00');
      expect(dashboard.series.investments.at(-1)?.value).toBe('4600.00');

      const other = await quickUser(ctx, 'investments-other');
      expect(error(await other.client.get(`/api/investments/${petr}`).expect(404)).code).toBe(
        'INVESTMENT_NOT_FOUND',
      );
      await other.client
        .post(`/api/investments/${petr}/transactions`)
        .send({ type: 'VALUATION', amount: '1.00', date: TODAY })
        .expect(404);
      await other.client.delete(`/api/investments/${petr}`).expect(404);
    });
  });

  describe('bens, dívidas e patrimônio', () => {
    it('CRUD de bens e dívidas; pagamento com conta', async () => {
      const house = data<{ id: string }>(
        await client
          .post('/api/assets')
          .send({
            name: 'Apartamento',
            type: 'REAL_ESTATE',
            value: '400000.00',
            acquiredAt: '2020-05-10',
          })
          .expect(201),
      ).id;
      await client.patch(`/api/assets/${house}`).send({ value: '410000.00' }).expect(200);
      const car = data<{ id: string }>(
        await client
          .post('/api/assets')
          .send({ name: 'Carro', type: 'VEHICLE', value: '50000.00' })
          .expect(201),
      ).id;
      await client.delete(`/api/assets/${car}`).expect(204);
      const assets = (await client.get('/api/assets').expect(200)).body as {
        meta: { total: string; byType: unknown[] };
      };
      expect(assets.meta).toEqual({
        total: '410000.00',
        count: 1,
        byType: [{ type: 'REAL_ESTATE', total: '410000.00' }],
      });

      const debt = data<{ id: string; paidPercent: number; remainingInstallments: number | null }>(
        await client
          .post('/api/liabilities')
          .send({
            name: 'Financiamento imóvel',
            type: 'FINANCING',
            principal: '200000.00',
            outstandingBalance: '150000.00',
            interestRate: '9.5',
            monthlyPayment: '2500.00',
            dueDay: 15,
          })
          .expect(201),
      );
      expect(debt).toMatchObject({ paidPercent: 25, remainingInstallments: 60 });
      const paid = data<{
        outstandingBalance: string;
        payments: { amount: string; account: { id: string } | null }[];
      }>(
        await client
          .post(`/api/liabilities/${debt.id}/payments`)
          .send({ amount: '2500.00', date: TODAY, accountId: account })
          .expect(201),
      );
      expect(paid.outstandingBalance).toBe('147500.00');
      expect(paid.payments).toEqual([
        expect.objectContaining({
          amount: '2500.00',
          account: expect.objectContaining({ id: account }),
        }),
      ]);
      expect(await balance()).toBe('4020.00');
      expect(
        error(
          await client
            .post(`/api/liabilities/${debt.id}/payments`)
            .send({ amount: '999999.00', date: TODAY })
            .expect(400),
        ).code,
      ).toBe('PAYMENT_EXCEEDS_BALANCE');
      await client
        .post(`/api/liabilities/${debt.id}/payments`)
        .send({ amount: '1.00', date: '2999-01-01' })
        .expect(400);
      const liabilities = (await client.get('/api/liabilities').expect(200)).body as {
        meta: Record<string, unknown>;
      };
      expect(liabilities.meta).toEqual({
        total: '147500.00',
        monthlyPayments: '2500.00',
        count: 1,
      });

      const other = await quickUser(ctx, 'assets-other');
      expect(
        error(await other.client.patch(`/api/assets/${house}`).send({ value: '1.00' }).expect(404))
          .code,
      ).toBe('ASSET_NOT_FOUND');
      expect(error(await other.client.get(`/api/liabilities/${debt.id}`).expect(404)).code).toBe(
        'LIABILITY_NOT_FOUND',
      );
    });

    it('patrimônio agrupado bate com o dashboard', async () => {
      const nw = data<{
        netWorth: string;
        assets: {
          total: string;
          groups: { key: string; total: string; items: { source: string }[] }[];
        };
        liabilities: { total: string; groups: { key: string; total: string }[] };
        debtRatio: number;
        series: { month: string; netWorth: string }[];
        change12m: { amount: string };
      }>(await client.get('/api/net-worth').expect(200));
      const dashboard = data<{
        netWorth: { current: string; assets: string; liabilities: string };
      }>(await client.get('/api/dashboard').expect(200));
      expect(nw.netWorth).toBe(dashboard.netWorth.current);
      expect(nw.assets.total).toBe(dashboard.netWorth.assets);
      expect(nw.liabilities.total).toBe(dashboard.netWorth.liabilities);
      // 4020 caixa + 4600 investimentos + 410000 imóvel − 147500 financiamento
      expect(nw.netWorth).toBe('271120.00');
      const groups = Object.fromEntries(nw.assets.groups.map((g) => [g.key, g.total]));
      expect(groups).toEqual({
        CASH: '4020.00',
        INVESTMENTS: '4600.00',
        REAL_ESTATE: '410000.00',
        VEHICLE: '0.00',
        OTHER: '0.00',
      });
      expect(nw.liabilities.groups.find((g) => g.key === 'FINANCING')?.total).toBe('147500.00');
      expect(nw.debtRatio).toBe(35.2);
      expect(nw.series).toHaveLength(12);
      expect(nw.series.at(-1)?.netWorth).toBe(nw.netWorth);
    });
  });

  describe('planejamento', () => {
    it('baseline: NONE → ONBOARDING → ACTUAL; premissas persistem', async () => {
      const empty = await quickUser(ctx, 'planning-empty');
      expect(
        data<{ dataQuality: string; averageMonthlyIncome: string | null }>(
          await empty.client.get('/api/planning/baseline').expect(200),
        ),
      ).toMatchObject({
        dataQuality: 'NONE',
        averageMonthlyIncome: null,
        emergencyFund: null,
        goals: [],
      });

      const s = await registerAndLogin(ctx, 'planning');
      await s.client
        .post('/api/users/me/onboarding')
        .send({
          monthlyIncome: '7000.00',
          monthlyExpenses: '4000.00',
          topExpenseCategoryIds: [],
          cashBalance: '5000.00',
          debts: { outstanding: '3000.00', monthlyPayment: '300.00' },
          goal: { category: 'TRAVEL', name: 'Viagem', targetAmount: '10000.00' },
          emergencyMonths: 6,
        })
        .expect(201);
      const onboarding = data<Record<string, unknown>>(
        await s.client.get('/api/planning/baseline').expect(200),
      );
      expect(onboarding).toMatchObject({
        dataQuality: 'ONBOARDING',
        averageMonthlyIncome: '7000.00',
        averageMonthlyExpense: '4000.00',
        averageMonthlySurplus: '3000.00',
        monthlyDebtPayments: '300.00',
        netWorth: '2000.00',
        cash: '5000.00',
        emergencyFund: { current: '0.00', target: '24000.00' },
        goals: [expect.objectContaining({ name: 'Viagem', targetAmount: '10000.00' })],
      });

      // Pagar a dívida do onboarding também funciona.
      const [liability] = (
        (await s.client.get('/api/liabilities').expect(200)).body as { data: { id: string }[] }
      ).data;
      await s.client
        .post(`/api/liabilities/${liability.id}/payments`)
        .send({ amount: '300.00', date: TODAY })
        .expect(201);

      const main = (
        (await s.client.get('/api/accounts').expect(200)).body as { data: { id: string }[] }
      ).data[0].id;
      const lastMonth = monthStart(addMonthsYm(yearMonthOf(TODAY), -1));
      await s.client
        .post('/api/transactions')
        .send({
          type: 'INCOME',
          amount: '9000.00',
          date: lastMonth,
          description: 'Salário',
          accountId: main,
        })
        .expect(201);
      await s.client
        .post('/api/transactions')
        .send({
          type: 'EXPENSE',
          amount: '5000.00',
          date: lastMonth,
          description: 'Gastos',
          accountId: main,
        })
        .expect(201);
      expect(
        data<Record<string, unknown>>(await s.client.get('/api/planning/baseline').expect(200)),
      ).toMatchObject({
        dataQuality: 'ACTUAL',
        averageMonthlyIncome: '9000.00',
        averageMonthlySurplus: '4000.00',
      });

      expect(
        data<Record<string, unknown>>(await s.client.get('/api/planning/assumptions').expect(200)),
      ).toEqual({
        horizonYears: 10,
        monthlyContribution: null,
        annualReturn: 8,
        incomeGrowth: 4,
        expenseGrowth: 4,
        inflation: 4,
      });
      const saved = {
        horizonYears: 25,
        monthlyContribution: '2500',
        annualReturn: 9.5,
        incomeGrowth: 3,
        expenseGrowth: 3.5,
        inflation: 4.25,
      };
      await s.client.put('/api/planning/assumptions').send(saved).expect(200);
      expect(
        data<Record<string, unknown>>(await s.client.get('/api/planning/assumptions').expect(200)),
      ).toEqual({ ...saved, monthlyContribution: '2500.00' });
      await s.client
        .put('/api/planning/assumptions')
        .send({ ...saved, horizonYears: 50 })
        .expect(400);
      await s.client
        .put('/api/planning/assumptions')
        .send({ ...saved, annualReturn: 31 })
        .expect(400);
    });
  });
});
