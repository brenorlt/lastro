import type { EntityRef, Transaction, TransactionsMeta } from "./finance";
import type { Goal, BudgetLevel } from "./planning";
import type { Investment, InvestmentType, NetWorthGroup } from "./wealth";

export type ReportKind = "cash-flow" | "categories" | "transactions" | "net-worth" | "investments" | "goals" | "budget";

export interface CashFlowReport {
  rows: { period: string; label: string; income: string; expense: string; net: string; cumulative: string }[];
  totals: { income: string; expense: string; net: string; averageMonthlyIncome: string; averageMonthlyExpense: string; savingsRate: number | null };
}

export interface CategoryRow {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  amount: string;
  share: number;
  count: number;
  previousAmount: string;
  change: number | null;
  children?: CategoryRow[];
}
export interface CategoriesReport { total: string; rows: CategoryRow[] }

export interface TransactionsReport { data: Transaction[]; meta: TransactionsMeta }

export interface NetWorthReport {
  rows: { month: string; assets: string; liabilities: string; netWorth: string }[];
  groups?: { assets: NetWorthGroup[]; liabilities: NetWorthGroup[] };
}

export interface InvestmentsReport {
  totals: { totalInvested: string; totalCurrent: string; profit: string; profitPercent: number | null; totalIncome?: string };
  byClass: { type: InvestmentType; current: string; invested: string; share: number }[];
  positions: Investment[];
  contributionsByMonth: { month: string; amount: string }[];
}

export interface GoalsReport { rows: Goal[]; totals: { target: string; saved: string } }

export interface BudgetReport {
  months: {
    month: string;
    totalLimit: string;
    totalSpent: string;
    percent: number;
    items: { category: EntityRef & { parentId: string | null }; limitAmount: string; spent: string; percent: number; level: BudgetLevel }[];
  }[];
}

export interface ReportFilters {
  from: string;
  to: string;
  accountId?: string;
  categoryId?: string;
  type?: "INCOME" | "EXPENSE";
}
