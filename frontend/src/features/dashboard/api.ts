import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { Dashboard } from "@/types/dashboard";

export const dashboardKeys = { month: (month: string) => ["dashboard", month] as const };

export function useDashboard(month: string) {
  return useQuery({
    queryKey: dashboardKeys.month(month),
    queryFn: async () => (await api.get<Dashboard>("/dashboard", { query: { month } })).data,
    placeholderData: keepPreviousData,
  });
}

/** "2026-09" → rótulo curto do eixo ("set"). */
export function shortMonth(ym: string, locale = "pt-BR") {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(y ?? 2000, (m ?? 1) - 1, 1)).replace(".", "");
}

/** Variação percentual com 1 casa; null quando a base é zero. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
