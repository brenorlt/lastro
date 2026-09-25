import { todayISO } from "@/lib/dates";
import type { GoalCategory, OnboardingInput } from "./api";

/** Respostas do assistente. Valores monetários como decimal em string ("" = não respondido). */
export interface Answers {
  monthlyIncome: string;
  monthlyExpenses: string;
  topExpenseCategoryIds: string[];
  cashBalance: string;
  institution: string;
  hasInvestments: boolean | null;
  investmentsTotal: string;
  hasDebts: boolean | null;
  debtsOutstanding: string;
  debtsMonthlyPayment: string;
  goalCategory: GoalCategory | null;
  goalName: string;
  goalTarget: string;
  goalDate: string;
  emergencyMonths: number;
}

export const INITIAL_ANSWERS: Answers = {
  monthlyIncome: "",
  monthlyExpenses: "",
  topExpenseCategoryIds: [],
  cashBalance: "",
  institution: "",
  hasInvestments: null,
  investmentsTotal: "",
  hasDebts: null,
  debtsOutstanding: "",
  debtsMonthlyPayment: "",
  goalCategory: null,
  goalName: "",
  goalTarget: "",
  goalDate: "",
  emergencyMonths: 6,
};

export const GOALS: { value: GoalCategory; label: string; description: string }[] = [
  { value: "EMERGENCY", label: "Reserva de emergência", description: "Segurança para imprevistos" },
  { value: "REAL_ESTATE", label: "Comprar um imóvel", description: "Entrada ou quitação" },
  { value: "VEHICLE", label: "Comprar um carro", description: "À vista ou com entrada maior" },
  { value: "TRAVEL", label: "Fazer uma viagem", description: "Sem parcelar no cartão" },
  { value: "RETIREMENT", label: "Aposentadoria", description: "Renda para o futuro" },
  { value: "FINANCIAL_INDEPENDENCE", label: "Independência financeira", description: "Viver de renda" },
  { value: "EDUCATION", label: "Educação", description: "Curso, pós, intercâmbio" },
  { value: "OTHER", label: "Outro objetivo", description: "Você define" },
];

export const isMoney = (v: string) => v !== "" && v !== "invalid";

/** Cada pergunta sabe se já pode avançar. */
export function canContinue(step: number, a: Answers): boolean {
  switch (step) {
    case 0:
      return isMoney(a.monthlyIncome);
    case 1:
      return isMoney(a.monthlyExpenses);
    case 2:
      return isMoney(a.cashBalance);
    case 3:
      return a.hasInvestments === false || (a.hasInvestments === true && isMoney(a.investmentsTotal));
    case 4:
      return a.hasDebts === false || (a.hasDebts === true && isMoney(a.debtsOutstanding) && a.debtsMonthlyPayment !== "invalid");
    case 5:
      return a.goalCategory !== null && a.goalTarget !== "invalid" && (!a.goalDate || a.goalDate > todayISO());
    case 6:
      return a.emergencyMonths >= 1 && a.emergencyMonths <= 24;
    default:
      return false;
  }
}

export function toInput(a: Answers): OnboardingInput {
  const goalLabel = GOALS.find((g) => g.value === a.goalCategory)?.label ?? "Meu objetivo";
  return {
    monthlyIncome: a.monthlyIncome,
    monthlyExpenses: a.monthlyExpenses,
    topExpenseCategoryIds: a.topExpenseCategoryIds,
    cashBalance: a.cashBalance,
    institution: a.institution.trim() || null,
    investments: a.hasInvestments ? { total: a.investmentsTotal } : null,
    debts: a.hasDebts ? { outstanding: a.debtsOutstanding, monthlyPayment: isMoney(a.debtsMonthlyPayment) ? a.debtsMonthlyPayment : null } : null,
    goal: a.goalCategory
      ? {
          category: a.goalCategory,
          name: a.goalName.trim() || goalLabel,
          targetAmount: isMoney(a.goalTarget) ? a.goalTarget : null,
          targetDate: a.goalDate || null,
        }
      : null,
    emergencyMonths: a.emergencyMonths,
  };
}

/** Prévia local da reserva (em centavos inteiros, sem float acumulado). */
export function emergencyTarget(monthlyExpenses: string, months: number): number {
  if (!isMoney(monthlyExpenses)) return 0;
  return (Math.round(Number(monthlyExpenses) * 100) * months) / 100;
}
