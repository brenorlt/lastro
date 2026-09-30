import { addMonthsYm, type YearMonth } from '../../common/utils/date-only.js';
import { Decimal, toMoneyString } from '../../common/utils/money.js';

// ───────────────────────── Formatação ─────────────────────────

/** Percentual com 1 casa (número), ex.: 35.64 → 35.6. */
export function pct1(value: Decimal): number {
  return Number(value.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));
}

export function formatCurrency(value: Decimal | string, currency = 'BRL'): string {
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency });
  // Intl usa NBSP entre símbolo e número; normalizamos para espaço comum.
  return formatter.format(new Decimal(value).toFixed(2) as `${number}`).replace(/\u00a0/g, ' ');
}

/** Número pt-BR com até 1 casa: 35.6 → "35,6"; 16 → "16". */
export function formatNumber1(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

// ───────────────────────── Fluxo mensal ─────────────────────────

export interface MonthlyFlowRow {
  month: YearMonth;
  type: 'INCOME' | 'EXPENSE';
  status: 'CLEARED' | 'PENDING' | 'SCHEDULED';
  amount: Decimal;
}

export interface MonthFlow {
  income: Decimal;
  expense: Decimal;
  pendingIncome: Decimal;
  pendingExpense: Decimal;
  /** Receitas − despesas apenas CLEARED (base da reconstrução de patrimônio). */
  clearedNet: Decimal;
}

const emptyFlow = (): MonthFlow => ({
  income: new Decimal(0),
  expense: new Decimal(0),
  pendingIncome: new Decimal(0),
  pendingExpense: new Decimal(0),
  clearedNet: new Decimal(0),
});

export function indexFlows(rows: MonthlyFlowRow[]): Map<YearMonth, MonthFlow> {
  const byMonth = new Map<YearMonth, MonthFlow>();
  for (const row of rows) {
    const flow = byMonth.get(row.month) ?? emptyFlow();
    const cleared = row.status === 'CLEARED';
    if (row.type === 'INCOME') {
      flow.income = flow.income.plus(row.amount);
      if (!cleared) flow.pendingIncome = flow.pendingIncome.plus(row.amount);
      if (cleared) flow.clearedNet = flow.clearedNet.plus(row.amount);
    } else {
      flow.expense = flow.expense.plus(row.amount);
      if (!cleared) flow.pendingExpense = flow.pendingExpense.plus(row.amount);
      if (cleared) flow.clearedNet = flow.clearedNet.minus(row.amount);
    }
    byMonth.set(row.month, flow);
  }
  return byMonth;
}

export const flowOf = (flows: Map<YearMonth, MonthFlow>, month: YearMonth) =>
  flows.get(month) ?? emptyFlow();

// ───────────────────────── Patrimônio ─────────────────────────

/**
 * Patrimônio ao fim de cada mês: atual − Σ fluxo líquido CLEARED dos meses posteriores.
 * Transferências são neutras. Snapshots (fim de mês) têm prioridade quando existem.
 */
export function reconstructNetWorth(
  currentNetWorth: Decimal,
  months: YearMonth[],
  flows: Map<YearMonth, MonthFlow>,
  snapshots: Map<YearMonth, Decimal> = new Map(),
): { points: { month: YearMonth; value: Decimal }[]; usedSnapshots: boolean } {
  const futureMonths = [...flows.keys()].sort();
  let usedSnapshots = false;
  const points = months.map((month) => {
    const snapshot = snapshots.get(month);
    if (snapshot) {
      usedSnapshots = true;
      return { month, value: snapshot };
    }
    let after = new Decimal(0);
    for (const m of futureMonths) if (m > month) after = after.plus(flowOf(flows, m).clearedNet);
    return { month, value: currentNetWorth.minus(after) };
  });
  return { points, usedSnapshots };
}

// ───────────────────────── Categorias ─────────────────────────

export interface CategorySpend {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  amount: Decimal;
}

export const UNCATEGORIZED = { name: 'Sem categoria', color: '#CBD5E1', icon: 'circle-dashed' };
export const OTHERS_BUCKET = { name: 'Outros', color: '#94A3B8', icon: 'ellipsis' };

/**
 * Top 6 categorias raiz (já agregadas) + bucket "Outros" com o restante.
 * "Sem categoria" entra como item próprio se estiver no top 6; senão cai em "Outros".
 */
export function rollupSpending(items: CategorySpend[], top = 6) {
  const positive = items.filter((i) => i.amount.greaterThan(0));
  const total = positive.reduce((acc, i) => acc.plus(i.amount), new Decimal(0));
  const sorted = [...positive].sort(
    (a, b) => b.amount.comparedTo(a.amount) || a.name.localeCompare(b.name),
  );
  const head = sorted.slice(0, top);
  const tail = sorted.slice(top);
  const buckets: CategorySpend[] = [...head];
  if (tail.length) {
    buckets.push({
      categoryId: null,
      ...OTHERS_BUCKET,
      amount: tail.reduce((acc, i) => acc.plus(i.amount), new Decimal(0)),
    });
  }
  return buckets.map((b) => ({
    categoryId: b.categoryId,
    name: b.name,
    color: b.color,
    icon: b.icon,
    amount: toMoneyString(b.amount),
    share: total.isZero() ? 0 : pct1(b.amount.div(total).times(100)),
  }));
}

// ───────────────────────── Reserva ─────────────────────────

/** Gasto médio: últimos 3 meses COMPLETOS com despesa → monthlyCost da reserva → onboarding. */
export function averageMonthlyExpense(
  currentMonth: YearMonth,
  flows: Map<YearMonth, MonthFlow>,
  fallbacks: (Decimal | string | null | undefined)[],
): Decimal | null {
  const complete: Decimal[] = [];
  for (let i = 1; i <= 12 && complete.length < 3; i++) {
    const expense = flowOf(flows, addMonthsYm(currentMonth, -i)).expense;
    if (expense.greaterThan(0)) complete.push(expense);
  }
  if (complete.length) {
    return complete.reduce((a, b) => a.plus(b), new Decimal(0)).div(complete.length);
  }
  for (const fallback of fallbacks) {
    if (fallback === null || fallback === undefined) continue;
    const value = new Decimal(fallback);
    if (value.greaterThan(0)) return value;
  }
  return null;
}

// ───────────────────────── Insights ─────────────────────────

export type InsightTone = 'positive' | 'neutral' | 'warning';

export interface Insight {
  key:
    | 'SPENDING_CHANGE'
    | 'SAVINGS_RATE'
    | 'EMERGENCY_COVERAGE'
    | 'TOP_CATEGORY'
    | 'OVERDUE'
    | 'INCOME_CHANGE';
  tone: InsightTone;
  message: string;
  basis: string;
  value: number | null;
}

export interface InsightInput {
  currency: string;
  income: Decimal;
  expense: Decimal;
  previousExpense: Decimal;
  /** Ausente = sem alerta de renda. */
  previousIncome?: Decimal;
  /**
   * `cashCoverageMonths` presente = reserva ainda sem dinheiro separado: a mensagem passa
   * a falar do saldo disponível em vez de afirmar "cobre 0 meses".
   */
  emergency: {
    coverageMonths: number | null;
    targetMonths: number;
    cashCoverageMonths?: number | null;
  } | null;
  topCategory: { name: string; share: number } | null;
  overdue: { count: number; amount: Decimal };
}

const months = (n: number) => `${formatNumber1(n)} ${n === 1 ? 'mês' : 'meses'}`;

export function buildInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const money = (v: Decimal) => formatCurrency(v, input.currency);

  if (input.previousExpense.greaterThan(0) && input.expense.greaterThan(0)) {
    const change = pct1(
      input.expense.minus(input.previousExpense).div(input.previousExpense).times(100),
    );
    const abs = formatNumber1(Math.abs(change));
    insights.push({
      key: 'SPENDING_CHANGE',
      tone: change < 0 ? 'positive' : change > 10 ? 'warning' : 'neutral',
      message:
        change === 0
          ? 'Você gastou o mesmo que no mês anterior.'
          : `Você gastou ${abs}% ${change < 0 ? 'menos' : 'mais'} que no mês anterior.`,
      basis: `${money(input.expense)} neste mês vs. ${money(input.previousExpense)} no anterior`,
      value: change,
    });
  }

  if (input.income.greaterThan(0)) {
    const rate = pct1(input.income.minus(input.expense).div(input.income).times(100));
    insights.push({
      key: 'SAVINGS_RATE',
      tone: rate >= 20 ? 'positive' : rate < 0 ? 'warning' : 'neutral',
      message: `Sua taxa de poupança está em ${formatNumber1(rate)}%.`,
      basis: '(receitas − despesas) ÷ receitas',
      value: rate,
    });
  }

  if (input.emergency && input.emergency.cashCoverageMonths !== undefined) {
    const cash = input.emergency.cashCoverageMonths;
    insights.push({
      key: 'EMERGENCY_COVERAGE',
      tone: 'neutral',
      message:
        cash !== null && cash > 0
          ? `Você ainda não separou sua reserva. Seu saldo disponível cobriria cerca de ${months(cash)} de gastos.`
          : 'Você ainda não separou sua reserva de emergência.',
      basis: `meta: ${months(input.emergency.targetMonths)} do seu custo de vida`,
      value: cash,
    });
  } else if (input.emergency && input.emergency.coverageMonths !== null) {
    const coverage = input.emergency.coverageMonths;
    insights.push({
      key: 'EMERGENCY_COVERAGE',
      tone:
        coverage >= input.emergency.targetMonths
          ? 'positive'
          : coverage < 3
            ? 'warning'
            : 'neutral',
      message: `Sua reserva financeira cobre aproximadamente ${months(coverage)}.`,
      basis: 'reserva ÷ gasto médio mensal',
      value: coverage,
    });
  }

  if (input.topCategory) {
    insights.push({
      key: 'TOP_CATEGORY',
      tone: 'neutral',
      message: `Sua maior categoria de gastos foi ${input.topCategory.name} (${formatNumber1(input.topCategory.share)}% das despesas).`,
      basis: 'despesas do mês por categoria',
      value: input.topCategory.share,
    });
  }

  if (input.overdue.count > 0) {
    const n = input.overdue.count;
    insights.push({
      key: 'OVERDUE',
      tone: 'warning',
      message: `Você tem ${n} ${n === 1 ? 'lançamento vencido' : 'lançamentos vencidos'} somando ${money(input.overdue.amount)}.`,
      basis: 'despesas pendentes com data anterior a hoje',
      value: n,
    });
  }

  if (input.previousIncome?.greaterThan(0) && input.income.greaterThan(0)) {
    const change = pct1(
      input.income.minus(input.previousIncome).div(input.previousIncome).times(100),
    );
    // Oscilações pequenas de renda não viram alerta.
    if (Math.abs(change) >= 5) {
      insights.push({
        key: 'INCOME_CHANGE',
        tone: change > 0 ? 'positive' : change <= -10 ? 'warning' : 'neutral',
        message: `Sua renda ${change > 0 ? 'aumentou' : 'caiu'} ${formatNumber1(Math.abs(change))}% em relação ao mês anterior.`,
        basis: `${money(input.income)} neste mês vs. ${money(input.previousIncome)} no anterior`,
        value: change,
      });
    }
  }

  return insights.slice(0, 6);
}
