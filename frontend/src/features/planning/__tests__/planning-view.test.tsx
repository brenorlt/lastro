import { render, screen } from "@testing-library/react";
import type { Assumptions } from "../projection";
import { PlanningView } from "../components/planning-view";

// Os números da tela que levantou o caso: sobra zero hoje, despesas crescendo mais que a renda.
const baseline = {
  netWorth: "64844.98",
  investable: "0.00",
  cash: "0.00",
  emergencyFund: null,
  averageMonthlyIncome: "7503.00",
  averageMonthlyExpense: "7503.00",
  averageMonthlySurplus: "0.00",
  monthlyDebtPayments: "0.00",
  goals: [],
  dataQuality: "ACTUAL",
};
let assumptions: Assumptions;

vi.mock("next/navigation", () => ({ usePathname: () => "/planejamento" }));
vi.mock("@/features/net-worth/api", () => ({
  usePlanningBaseline: () => ({ data: baseline, isPending: false, isError: false }),
  usePlanningAssumptions: () => ({ data: assumptions, isPending: false }),
  saveAssumptions: vi.fn(() => Promise.resolve()),
}));

const premissas = (p: Partial<Assumptions> = {}): Assumptions => ({
  horizonYears: 10,
  monthlyContribution: null,
  annualReturn: 13.5,
  incomeGrowth: 1,
  expenseGrowth: 4,
  inflation: 4,
  ...p,
});

// Os sliders e switches do Radix medem o tamanho; o jsdom não tem ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("PlanningView com patrimônio que acaba", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-26T12:00:00") }));
  afterEach(() => vi.useRealTimers());

  it("avisa no cenário em que o dinheiro acaba", () => {
    assumptions = premissas();
    render(<PlanningView />);
    // Só o conservador zera; o base termina positivo e mantém o resumo de sempre.
    expect(screen.getAllByText("Patrimônio acaba até 2034")).toHaveLength(1);
    expect(screen.getByText(/No cenário base, cerca de/)).toBeInTheDocument();
    expect(screen.getByText("Retiradas para cobrir despesas")).toBeInTheDocument();
  });

  it("explica no gráfico quando é o cenário base que acaba", () => {
    assumptions = premissas({ annualReturn: 4 });
    render(<PlanningView />);
    expect(screen.getByText(/No cenário base, as despesas passam a renda e o patrimônio acaba até 20\d\d\./)).toBeInTheDocument();
  });
});
