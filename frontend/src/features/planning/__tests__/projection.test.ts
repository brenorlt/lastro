import { applyScenario, DEFAULT_ASSUMPTIONS, depletionYear, independenceYear, project } from "../projection";

const base = { startWealth: 100_000, monthlyIncome: 10_000, monthlyExpense: 6_000 };

describe("projection", () => {
  it("sem rentabilidade nem crescimento, soma exatamente os aportes", () => {
    const pts = project(base, { ...DEFAULT_ASSUMPTIONS, annualReturn: 0, incomeGrowth: 0, expenseGrowth: 0, horizonYears: 2 }, 2026);
    expect(pts).toHaveLength(3);
    expect(pts[2]!.wealth).toBeCloseTo(100_000 + 4_000 * 24, 6);
    expect(pts[2]!.contributed).toBeCloseTo(96_000, 6);
    expect(pts[2]!.returns).toBeCloseTo(0, 6);
  });

  it("taxa anual composta mensalmente equivale à anual informada", () => {
    const pts = project({ startWealth: 1000, monthlyIncome: 0, monthlyExpense: 0 }, { ...DEFAULT_ASSUMPTIONS, annualReturn: 10, horizonYears: 1 });
    expect(pts[1]!.wealth).toBeCloseTo(1100, 6);
  });

  it("aporte fixo substitui a sobra", () => {
    const pts = project(base, { ...DEFAULT_ASSUMPTIONS, annualReturn: 0, monthlyContribution: 1000, horizonYears: 1 });
    expect(pts[1]!.wealth).toBeCloseTo(112_000, 6);
  });

  it("valor real desconta a inflação", () => {
    const pts = project({ startWealth: 1000, monthlyIncome: 0, monthlyExpense: 0 }, { ...DEFAULT_ASSUMPTIONS, annualReturn: 4, inflation: 4, horizonYears: 1 });
    expect(pts[1]!.realWealth).toBeCloseTo(1000, 6);
  });

  it("cenários ficam ordenados: conservador ≤ base ≤ otimista", () => {
    const final = (k: "conservative" | "base" | "optimistic") => project(base, applyScenario(DEFAULT_ASSUMPTIONS, k)).at(-1)!.wealth;
    expect(final("conservative")).toBeLessThan(final("base"));
    expect(final("base")).toBeLessThan(final("optimistic"));
  });

  it("gasto maior que renda consome patrimônio", () => {
    const pts = project({ startWealth: 10_000, monthlyIncome: 1000, monthlyExpense: 2000 }, { ...DEFAULT_ASSUMPTIONS, annualReturn: 0, incomeGrowth: 0, expenseGrowth: 0, horizonYears: 1 });
    expect(pts[1]!.wealth).toBeCloseTo(-2000, 6);
  });

  it("independência: 4% do patrimônio cobrindo as despesas", () => {
    const pts = project({ startWealth: 1_800_000, monthlyIncome: 10_000, monthlyExpense: 6_000 }, { ...DEFAULT_ASSUMPTIONS, horizonYears: 5 });
    expect(independenceYear(pts)?.offset).toBe(1);
    expect(independenceYear(project({ startWealth: 0, monthlyIncome: 1000, monthlyExpense: 1000 }, DEFAULT_ASSUMPTIONS))).toBeNull();
  });

  it("patrimônio negativo não rende: o déficit se acumula sem a rentabilidade da carteira", () => {
    const pts = project({ startWealth: 1000, monthlyIncome: 0, monthlyExpense: 2000 }, { ...DEFAULT_ASSUMPTIONS, annualReturn: 12, incomeGrowth: 0, expenseGrowth: 0, horizonYears: 1 }, 2026);
    const r = Math.pow(1.12, 1 / 12) - 1;
    // Só o primeiro mês rende (sobre os R$ 1.000); depois disso o saldo já é negativo.
    expect(pts[1]!.returns).toBeCloseTo(1000 * r, 6);
    expect(pts[1]!.wealth).toBeCloseTo(1000 * (1 + r) - 24_000, 6);
  });

  it("depletionYear: primeiro ano em que o patrimônio acaba", () => {
    const pts = project({ startWealth: 10_000, monthlyIncome: 1000, monthlyExpense: 1500 }, { ...DEFAULT_ASSUMPTIONS, annualReturn: 0, incomeGrowth: 0, expenseGrowth: 0, horizonYears: 5 }, 2026);
    // −R$ 6.000 por ano: R$ 4.000 no fim do 1º ano, −R$ 2.000 no fim do 2º.
    expect(depletionYear(pts)?.year).toBe(2028);
    expect(depletionYear(project(base, DEFAULT_ASSUMPTIONS))).toBeNull();
    expect(depletionYear(project({ startWealth: -5000, monthlyIncome: 0, monthlyExpense: 100 }, DEFAULT_ASSUMPTIONS))).toBeNull();
  });
});
