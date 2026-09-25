/**
 * Motor de projeção patrimonial (puro, determinístico, sem I/O).
 * Estimativa baseada em premissas — nunca uma promessa de resultado.
 *
 * Mês a mês: patrimônio = patrimônio × (1 + r_mensal) + aporte.
 * Aporte = valor fixo informado, ou (renda − despesa) do ano, que crescem pelas taxas anuais.
 */

export interface Assumptions {
  horizonYears: number;
  /** null = usar a sobra (renda − despesa) de cada ano. */
  monthlyContribution: number | null;
  annualReturn: number;
  incomeGrowth: number;
  expenseGrowth: number;
  inflation: number;
}

export interface Baseline {
  startWealth: number;
  monthlyIncome: number;
  monthlyExpense: number;
}

export interface YearPoint {
  year: number;
  /** Anos a partir de hoje (0 = hoje). */
  offset: number;
  wealth: number;
  /** Mesmo valor em moeda de hoje (descontada a inflação). */
  realWealth: number;
  contributed: number;
  returns: number;
  monthlyIncome: number;
  monthlyExpense: number;
}

export type ScenarioKey = "conservative" | "base" | "optimistic";

export const SCENARIOS: { key: ScenarioKey; label: string; delta: { annualReturn: number; incomeGrowth: number; expenseGrowth: number } }[] = [
  { key: "conservative", label: "Conservador", delta: { annualReturn: -3, incomeGrowth: -1, expenseGrowth: 1 } },
  { key: "base", label: "Base", delta: { annualReturn: 0, incomeGrowth: 0, expenseGrowth: 0 } },
  { key: "optimistic", label: "Otimista", delta: { annualReturn: 2, incomeGrowth: 1, expenseGrowth: -1 } },
];

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  horizonYears: 10,
  monthlyContribution: null,
  annualReturn: 8,
  incomeGrowth: 4,
  expenseGrowth: 4,
  inflation: 4,
};

const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

export function project(baseline: Baseline, a: Assumptions, startYear = new Date().getFullYear()): YearPoint[] {
  const r = monthlyRate(a.annualReturn);
  let wealth = baseline.startWealth;
  let contributed = 0;
  let returns = 0;
  const points: YearPoint[] = [
    { year: startYear, offset: 0, wealth, realWealth: wealth, contributed: 0, returns: 0, monthlyIncome: baseline.monthlyIncome, monthlyExpense: baseline.monthlyExpense },
  ];

  for (let y = 1; y <= a.horizonYears; y++) {
    const income = baseline.monthlyIncome * Math.pow(1 + a.incomeGrowth / 100, y - 1);
    const expense = baseline.monthlyExpense * Math.pow(1 + a.expenseGrowth / 100, y - 1);
    const contribution = a.monthlyContribution ?? income - expense;
    for (let m = 0; m < 12; m++) {
      const gain = wealth * r;
      returns += gain;
      wealth += gain + contribution;
      contributed += contribution;
    }
    points.push({
      year: startYear + y,
      offset: y,
      wealth,
      realWealth: wealth / Math.pow(1 + a.inflation / 100, y),
      contributed,
      returns,
      monthlyIncome: income,
      monthlyExpense: expense,
    });
  }
  return points;
}

export function applyScenario(a: Assumptions, key: ScenarioKey): Assumptions {
  const d = SCENARIOS.find((s) => s.key === key)!.delta;
  return { ...a, annualReturn: a.annualReturn + d.annualReturn, incomeGrowth: a.incomeGrowth + d.incomeGrowth, expenseGrowth: a.expenseGrowth + d.expenseGrowth };
}

/**
 * Primeiro ano em que 4% ao ano do patrimônio cobririam as despesas do ano ("regra dos 4%").
 * Referência educativa amplamente usada — não é garantia de independência financeira.
 */
export function independenceYear(points: YearPoint[]): YearPoint | null {
  return points.find((p) => p.offset > 0 && p.wealth > 0 && (p.wealth * 0.04) / 12 >= p.monthlyExpense) ?? null;
}
