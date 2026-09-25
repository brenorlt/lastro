import type { Transaction } from "./finance";

export type InsightTone = "positive" | "neutral" | "warning";

export interface DashboardInsight {
  key: "SPENDING_CHANGE" | "SAVINGS_RATE" | "EMERGENCY_COVERAGE" | "TOP_CATEGORY" | "OVERDUE" | string;
  tone: InsightTone;
  message: string;
  basis: string;
  value: number | null;
}

export interface DashboardGoal {
  id: string;
  name: string;
  category: string;
  currentAmount: string;
  targetAmount: string;
  targetDate: string | null;
  progress: number;
  monthlyContributionNeeded: string | null;
  status: string;
}

export interface Dashboard {
  month: string;
  netWorth: { current: string; assets: string; liabilities: string; changeAmount12m: string; change12m: number | null };
  cash: { available: string };
  investments: { total: string };
  flow: {
    income: string;
    expense: string;
    net: string;
    pendingIncome: string;
    pendingExpense: string;
    previousIncome: string;
    previousExpense: string;
  };
  emergencyFund: { current: string; target: string; targetMonths: number; coverageMonths: number | null; progress: number | null } | null;
  commitments: { next30Days: string; pendingCount: number; overdueCount: number; overdueAmount: string };
  series: {
    netWorth: { month: string; value: string }[];
    netWorthMethod?: "reconstructed" | "snapshots";
    cashflow: { month: string; income: string; expense: string }[];
    spendingByCategory: { categoryId: string | null; name: string; color: string; icon: string; amount: string; share: number }[];
  };
  goals: DashboardGoal[];
  upcoming: Transaction[];
  recent: Transaction[];
  insights: DashboardInsight[];
}
