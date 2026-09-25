import { INITIAL_ANSWERS, canContinue, emergencyTarget, toInput, type Answers } from "../model";

const filled: Answers = {
  ...INITIAL_ANSWERS,
  monthlyIncome: "10000",
  monthlyExpenses: "6000",
  cashBalance: "18000",
  hasInvestments: true,
  investmentsTotal: "50000",
  hasDebts: false,
  goalCategory: "TRAVEL",
  goalTarget: "20000",
  goalDate: "2099-05-01",
  emergencyMonths: 6,
};

describe("onboarding model", () => {
  it("só avança com a pergunta respondida", () => {
    expect(canContinue(0, INITIAL_ANSWERS)).toBe(false);
    expect(canContinue(0, { ...INITIAL_ANSWERS, monthlyIncome: "0" })).toBe(true);
    expect(canContinue(3, { ...INITIAL_ANSWERS, hasInvestments: true })).toBe(false);
    expect(canContinue(3, { ...INITIAL_ANSWERS, hasInvestments: false })).toBe(true);
    expect(canContinue(5, INITIAL_ANSWERS)).toBe(false);
    expect(canContinue(6, INITIAL_ANSWERS)).toBe(true);
    expect(canContinue(5, { ...INITIAL_ANSWERS, goalCategory: "TRAVEL", goalDate: "2000-01-01" })).toBe(false);
  });

  it("monta o payload da API com nome padrão da meta e sem dívidas", () => {
    const input = toInput(filled);
    expect(input.investments).toEqual({ total: "50000" });
    expect(input.debts).toBeNull();
    expect(input.goal).toEqual({ category: "TRAVEL", name: "Fazer uma viagem", targetAmount: "20000", targetDate: "2099-05-01" });
    expect(input.institution).toBeNull();
  });

  it("calcula a reserva ideal sem erro de ponto flutuante", () => {
    expect(emergencyTarget("6000", 6)).toBe(36000);
    expect(emergencyTarget("1234.57", 3)).toBe(3703.71);
    expect(emergencyTarget("", 6)).toBe(0);
  });
});
