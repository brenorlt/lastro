import type { EntityRef } from "./finance";

export type BudgetLevel = "OK" | "ATTENTION" | "WARNING" | "EXCEEDED";

export interface Budget {
  id: string;
  month: string;
  category: EntityRef & { parentId: string | null };
  limitAmount: string;
  spent: string;
  remaining: string;
  percent: number;
  level: BudgetLevel;
  alertThresholds: number[];
}

export interface BudgetsMeta {
  month: string;
  totalLimit: string;
  totalSpent: string;
  remaining: string;
  percent: number;
  unbudgetedSpent: string;
  uncategorizedSpent: string;
}

export interface BudgetSuggestion {
  category: EntityRef & { parentId: string | null };
  averageSpent: string;
  lastMonthSpent: string;
}

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
export type GoalStatus = "ACTIVE" | "COMPLETED" | "PAUSED" | "ARCHIVED";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export interface Goal {
  id: string;
  name: string;
  category: GoalCategory;
  color: string;
  icon: string;
  priority: Priority;
  status: GoalStatus;
  targetAmount: string;
  currentAmount: string;
  remaining: string;
  progress: number;
  targetDate: string | null;
  monthsLeft: number | null;
  requiredMonthly: string | null;
  monthlyContribution: string | null;
  projectedCompletionDate: string | null;
  onTrack: boolean | null;
  contributionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  amount: string;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface GoalDetail extends Goal {
  contributions: GoalContribution[];
  series: { month: string; saved: string }[];
}

export interface GoalInput {
  name: string;
  category: GoalCategory;
  targetAmount: string;
  currentAmount?: string;
  targetDate?: string | null;
  priority?: Priority;
  monthlyContribution?: string | null;
  color?: string;
  icon?: string;
  status?: GoalStatus;
}

export interface EmergencyFund {
  monthlyCost: string;
  targetMonths: number;
  targetAmount: string;
  customTarget: boolean;
  mode: "LINKED" | "MANUAL";
  linkedAccount: (EntityRef & { currentBalance: string }) | null;
  currentAmount: string;
  remaining: string;
  progress: number;
  coverageMonths: number | null;
  monthlyContribution: string | null;
  monthsToTarget: number | null;
  projectedDate: string | null;
  suggestions: { averageMonthlyExpense: string | null; averageMonthlySurplus: string | null };
}

export interface EmergencyFundInput {
  monthlyCost: string;
  targetMonths: number;
  targetAmount?: string | null;
  linkedAccountId?: string | null;
  currentAmount?: string;
  monthlyContribution?: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
