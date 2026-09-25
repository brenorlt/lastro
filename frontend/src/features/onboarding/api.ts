import { api } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { User } from "@/types/auth";

export type GoalCategory =
  | "EMERGENCY"
  | "REAL_ESTATE"
  | "VEHICLE"
  | "TRAVEL"
  | "RETIREMENT"
  | "FINANCIAL_INDEPENDENCE"
  | "EQUIPMENT"
  | "EDUCATION"
  | "OTHER";

export interface OnboardingInput {
  monthlyIncome: string;
  monthlyExpenses: string;
  topExpenseCategoryIds: string[];
  cashBalance: string;
  institution?: string | null;
  investments: { total: string } | null;
  debts: { outstanding: string; monthlyPayment?: string | null } | null;
  goal: { category: GoalCategory; name: string; targetAmount?: string | null; targetDate?: string | null } | null;
  emergencyMonths: number;
}

export interface OnboardingSummary {
  netWorth: string;
  cash: string;
  investments: string;
  debts: string;
  savingsRate: number | null;
  monthlySurplus: string;
  emergencyTarget: string;
  emergencyCoverageMonths: number | null;
  goalMonthlyContribution: string | null;
}

export const onboardingApi = {
  async complete(input: OnboardingInput) {
    const { data } = await api.post<{ user: User; summary: OnboardingSummary }>("/users/me/onboarding", input);
    useAuthStore.getState().setUser(data.user);
    return data.summary;
  },
  async skip() {
    const { data } = await api.post<User>("/users/me/onboarding/skip");
    useAuthStore.getState().setUser(data);
  },
};
