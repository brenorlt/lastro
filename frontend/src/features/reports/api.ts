import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { BudgetReport, CashFlowReport, CategoriesReport, GoalsReport, InvestmentsReport, NetWorthReport, ReportFilters, ReportKind } from "@/types/reports";
import type { Transaction, TransactionsMeta } from "@/types/finance";

type Q = Record<string, string | number | boolean | undefined>;

function useReport<T>(kind: ReportKind, query: Q, enabled = true) {
  return useQuery({
    queryKey: ["reports", kind, query],
    queryFn: async () => (await api.get<T>(`/reports/${kind}`, { query })).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

const base = (f: ReportFilters): Q => ({ from: f.from, to: f.to, accountId: f.accountId, categoryId: f.categoryId });

export const useCashFlowReport = (f: ReportFilters, granularity: "day" | "week" | "month", on: boolean) =>
  useReport<CashFlowReport>("cash-flow", { ...base(f), granularity }, on);
export const useCategoriesReport = (f: ReportFilters, type: "INCOME" | "EXPENSE", on: boolean) =>
  useReport<CategoriesReport>("categories", { ...base(f), type }, on);
export const useNetWorthReport = (months: number, on: boolean) => useReport<NetWorthReport>("net-worth", { months }, on);
export const useInvestmentsReport = (on: boolean) => useReport<InvestmentsReport>("investments", {}, on);
export const useGoalsReport = (on: boolean) => useReport<GoalsReport>("goals", {}, on);
export const useBudgetReport = (fromMonth: string, toMonth: string, on: boolean) => useReport<BudgetReport>("budget", { fromMonth, toMonth }, on);

export function useTransactionsReport(f: ReportFilters, page: number, on: boolean) {
  return useQuery({
    queryKey: ["reports", "transactions", base(f), page],
    queryFn: () => api.get<Transaction[], TransactionsMeta>("/reports/transactions", { query: { ...base(f), type: f.type, page, pageSize: 100 } }),
    placeholderData: keepPreviousData,
    enabled: on,
  });
}

export function exportReport(kind: ReportKind, format: "csv" | "pdf", query: Q) {
  return api.download(`/reports/${kind}/export`, { ...query, format }, `lastro-${kind}.${format}`);
}
