import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import {
  averageMonthlyExpense,
  buildInsights,
  type CategorySpend,
  formatCurrency,
  indexFlows,
  type InsightInput,
  type MonthlyFlowRow,
  reconstructNetWorth,
  rollupSpending,
} from './dashboard.calc.js';
import { netWorthParts } from './dashboard.service.js';

const row = (
  month: string,
  type: 'INCOME' | 'EXPENSE',
  status: 'CLEARED' | 'PENDING',
  amount: string,
): MonthlyFlowRow => ({
  month,
  type,
  status,
  amount: new Decimal(amount),
});

describe('fluxos e reconstrução de patrimônio', () => {
  const flows = indexFlows([
    row('2026-07', 'INCOME', 'CLEARED', '5000'),
    row('2026-07', 'EXPENSE', 'CLEARED', '3000'),
    row('2026-08', 'INCOME', 'CLEARED', '5000'),
    row('2026-08', 'EXPENSE', 'CLEARED', '4500.50'),
    row('2026-08', 'EXPENSE', 'PENDING', '800'),
    row('2026-09', 'EXPENSE', 'CLEARED', '1000'),
    row('2026-09', 'INCOME', 'PENDING', '5000'),
  ]);

  it('indexa ambos os status em receita/despesa e só CLEARED no líquido', () => {
    const aug = flows.get('2026-08');
    expect(aug?.expense.toFixed(2)).toBe('5300.50');
    expect(aug?.pendingExpense.toFixed(2)).toBe('800.00');
    expect(aug?.clearedNet.toFixed(2)).toBe('499.50');
    expect(flows.get('2026-09')?.clearedNet.toFixed(2)).toBe('-1000.00');
  });

  it('valor(m) = atual − Σ líquido CLEARED dos meses posteriores; snapshot tem prioridade', () => {
    const { points, usedSnapshots } = reconstructNetWorth(
      new Decimal('10000'),
      ['2026-06', '2026-07', '2026-08', '2026-09'],
      flows,
    );
    expect(points.map((p) => p.value.toFixed(2))).toEqual([
      '8500.50',
      '10500.50',
      '11000.00',
      '10000.00',
    ]);
    expect(usedSnapshots).toBe(false);

    const withSnap = reconstructNetWorth(
      new Decimal('10000'),
      ['2026-07', '2026-08'],
      flows,
      new Map([['2026-07', new Decimal('9999')]]),
    );
    expect(withSnap.points.map((p) => p.value.toFixed(2))).toEqual(['9999.00', '11000.00']);
    expect(withSnap.usedSnapshots).toBe(true);
  });

  it('gasto médio: 3 últimos meses completos com dados → fallbacks', () => {
    expect(averageMonthlyExpense('2026-09', flows, ['100'])?.toFixed(2)).toBe('4150.25');
    expect(averageMonthlyExpense('2026-07', flows, [null, '6000.00'])?.toFixed(2)).toBe('6000.00');
    expect(averageMonthlyExpense('2026-07', flows, [new Decimal(0), undefined])).toBeNull();
  });
});

describe('composição do patrimônio', () => {
  it('separa caixa, investimentos, bens e dívidas', () => {
    const parts = netWorthParts({
      accounts: [
        { type: 'CHECKING', currentBalance: '1000.10' },
        { type: 'WALLET', currentBalance: '-0.10' },
        { type: 'INVESTMENT', currentBalance: '500' },
      ],
      investmentsValue: '250',
      assetsValue: '40000',
      liabilities: '1500',
    });
    expect(
      Object.fromEntries(
        Object.entries(parts).map(([k, v]: [string, Decimal]) => [k, v.toFixed(2)]),
      ),
    ).toEqual({
      cash: '1000.00',
      investments: '750.00',
      assets: '41750.00',
      liabilities: '1500.00',
      netWorth: '40250.00',
    });
  });
});

describe('gastos por categoria', () => {
  const item = (name: string, amount: string, categoryId: string | null = name): CategorySpend => ({
    categoryId,
    name,
    color: '#000000',
    icon: 'tag',
    amount: new Decimal(amount),
  });

  it('top 6 + "Outros" com o restante (inclui sem categoria fora do top)', () => {
    const result = rollupSpending([
      item('A', '400'),
      item('B', '200'),
      item('C', '150'),
      item('D', '100'),
      item('E', '50'),
      item('F', '40'),
      item('G', '30'),
      item('Sem categoria', '20', null),
      item('Z', '0'),
    ]);
    expect(result.map((r) => r.name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'Outros']);
    expect(result[6]).toMatchObject({
      categoryId: null,
      amount: '50.00',
      color: '#94A3B8',
      icon: 'ellipsis',
      share: 5.1, // 50 ÷ 990
    });
    expect(result[0].share).toBe(40.4); // 400 ÷ 990
  });

  it('"Sem categoria" aparece como item próprio quando está no top', () => {
    const result = rollupSpending([item('Sem categoria', '300', null), item('A', '100')]);
    expect(result.map((r) => [r.name, r.share])).toEqual([
      ['Sem categoria', 75],
      ['A', 25],
    ]);
    expect(rollupSpending([])).toEqual([]);
  });
});

describe('insights', () => {
  const base: InsightInput = {
    currency: 'BRL',
    income: new Decimal('10000'),
    expense: new Decimal('6440'),
    previousExpense: new Decimal('7666.67'),
    emergency: { coverageMonths: 4.1, targetMonths: 6 },
    topCategory: { name: 'Moradia', share: 37 },
    overdue: { count: 2, amount: new Decimal('540') },
  };

  it('gera as 5 mensagens na ordem com formatação pt-BR', () => {
    const insights = buildInsights(base);
    expect(insights.map((i) => i.key)).toEqual([
      'SPENDING_CHANGE',
      'SAVINGS_RATE',
      'EMERGENCY_COVERAGE',
      'TOP_CATEGORY',
      'OVERDUE',
    ]);
    expect(insights[0]).toMatchObject({
      tone: 'positive',
      message: 'Você gastou 16% menos que no mês anterior.',
      value: -16,
    });
    expect(insights[0].basis).toBe('R$ 6.440,00 neste mês vs. R$ 7.666,67 no anterior');
    expect(insights[1]).toMatchObject({
      tone: 'positive',
      message: 'Sua taxa de poupança está em 35,6%.',
      value: 35.6,
    });
    expect(insights[2]).toMatchObject({
      tone: 'neutral',
      message: 'Sua reserva financeira cobre aproximadamente 4,1 meses.',
    });
    expect(insights[3].message).toBe(
      'Sua maior categoria de gastos foi Moradia (37% das despesas).',
    );
    expect(insights[4]).toMatchObject({
      tone: 'warning',
      message: 'Você tem 2 lançamentos vencidos somando R$ 540,00.',
    });
  });

  it('limiares de tom', () => {
    const more = buildInsights({
      ...base,
      expense: new Decimal('8500'),
      previousExpense: new Decimal('7500'),
    });
    expect(more[0]).toMatchObject({
      tone: 'warning',
      message: 'Você gastou 13,3% mais que no mês anterior.',
    });
    const slightly = buildInsights({
      ...base,
      expense: new Decimal('105'),
      previousExpense: new Decimal('100'),
    });
    expect(slightly[0].tone).toBe('neutral');
    const negative = buildInsights({
      ...base,
      income: new Decimal('1000'),
      expense: new Decimal('1200'),
    });
    expect(negative.find((i) => i.key === 'SAVINGS_RATE')).toMatchObject({
      tone: 'warning',
      value: -20,
    });
    const low = buildInsights({
      ...base,
      income: new Decimal('1000'),
      expense: new Decimal('900'),
    });
    expect(low.find((i) => i.key === 'SAVINGS_RATE')?.tone).toBe('neutral');
    expect(
      buildInsights({ ...base, emergency: { coverageMonths: 6, targetMonths: 6 } })[2].tone,
    ).toBe('positive');
    expect(
      buildInsights({ ...base, emergency: { coverageMonths: 1, targetMonths: 6 } })[2],
    ).toMatchObject({
      tone: 'warning',
      message: 'Sua reserva financeira cobre aproximadamente 1 mês.',
    });
    expect(
      buildInsights({ ...base, overdue: { count: 1, amount: new Decimal('10') } })[4].message,
    ).toBe('Você tem 1 lançamento vencido somando R$ 10,00.');
  });

  it('alerta de renda: só com base anterior e variação ≥ 5%', () => {
    const income = (current: string, previous?: string) =>
      buildInsights({
        ...base,
        income: new Decimal(current),
        previousIncome: previous ? new Decimal(previous) : undefined,
      }).find((i) => i.key === 'INCOME_CHANGE');

    expect(income('10000')).toBeUndefined();
    expect(income('10200', '10000')).toBeUndefined();
    expect(income('11500', '10000')).toMatchObject({
      tone: 'positive',
      message: 'Sua renda aumentou 15% em relação ao mês anterior.',
      basis: 'R$ 11.500,00 neste mês vs. R$ 10.000,00 no anterior',
      value: 15,
    });
    expect(income('9300', '10000')).toMatchObject({ tone: 'neutral', value: -7 });
    expect(income('7000', '10000')).toMatchObject({
      tone: 'warning',
      message: 'Sua renda caiu 30% em relação ao mês anterior.',
    });
  });

  it('reserva sem dinheiro separado fala do saldo disponível, não de "0 meses"', () => {
    const r = buildInsights({
      ...base,
      emergency: { coverageMonths: 0, targetMonths: 6, cashCoverageMonths: 3 },
    })[2];
    expect(r).toMatchObject({
      key: 'EMERGENCY_COVERAGE',
      tone: 'neutral',
      message:
        'Você ainda não separou sua reserva. Seu saldo disponível cobriria cerca de 3 meses de gastos.',
      basis: 'meta: 6 meses do seu custo de vida',
    });
    expect(
      buildInsights({
        ...base,
        emergency: { coverageMonths: 0, targetMonths: 6, cashCoverageMonths: null },
      })[2].message,
    ).toBe('Você ainda não separou sua reserva de emergência.');
  });

  it('omite o que não é calculável', () => {
    const insights = buildInsights({
      currency: 'USD',
      income: new Decimal(0),
      expense: new Decimal('10'),
      previousExpense: new Decimal(0),
      emergency: { coverageMonths: null, targetMonths: 6 },
      topCategory: null,
      overdue: { count: 0, amount: new Decimal(0) },
    });
    expect(insights).toEqual([]);
    expect(formatCurrency('1234.5', 'USD')).toBe('US$ 1.234,50');
  });
});
