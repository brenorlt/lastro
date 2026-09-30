import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatPercent } from "@/lib/format";
import { api } from "@/services/api-client";
import type { Dashboard, DashboardInsight, MarketInsight, MarketInsights } from "@/types/dashboard";

export const dashboardKeys = {
  month: (month: string) => ["dashboard", month] as const,
  market: ["market", "insights"] as const,
};

/** O backend cacheia as cotações por 10 min; buscar mais que isso não traz nada novo. */
const MARKET_REFRESH_MS = 10 * 60 * 1000;

export function useMarketInsights() {
  return useQuery({
    queryKey: dashboardKeys.market,
    queryFn: async () => (await api.get<MarketInsights>("/market/insights")).data,
    staleTime: MARKET_REFRESH_MS / 2,
    refetchInterval: MARKET_REFRESH_MS,
    retry: 1,
  });
}

export type TickerItem =
  | { source: "personal"; insight: DashboardInsight }
  | { source: "market"; insight: MarketInsight };

/**
 * Ordem do letreiro: alertas pessoais primeiro (vencidos, gasto subindo, renda caindo),
 * depois pessoais e mercado intercalados para a tela não ficar só em cotações.
 */
export function tickerItems(personal: DashboardInsight[], market: MarketInsight[]): TickerItem[] {
  const warnings = personal.filter((i) => i.tone === "warning");
  const rest = personal.filter((i) => i.tone !== "warning");
  const items: TickerItem[] = warnings.map((insight) => ({ source: "personal", insight }));
  for (let i = 0; i < Math.max(rest.length, market.length); i += 1) {
    const m = market[i];
    const p = rest[i];
    if (m) items.push({ source: "market", insight: m });
    if (p) items.push({ source: "personal", insight: p });
  }
  return items;
}

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

const number1 = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);

/** Número de destaque do letreiro: o valor grande à direita e o que ele mede. */
export function tickerHeadline(item: TickerItem): { value: string; label: string; trend?: "up" | "down" | "flat" } | null {
  if (item.source === "market") {
    const { value, trend, symbol } = item.insight;
    return { value: formatPercent(value, { fractionDigits: 2, signed: true }), label: symbol === "IBOV" ? "Ibovespa" : symbol, trend };
  }
  const { key, value } = item.insight;
  if (value === null) return null;
  const trend = value > 0 ? "up" : value < 0 ? "down" : "flat";
  switch (key) {
    case "SPENDING_CHANGE":
      return { value: formatPercent(value, { signed: true }), label: "gastos", trend };
    case "INCOME_CHANGE":
      return { value: formatPercent(value, { signed: true }), label: "renda", trend };
    case "SAVINGS_RATE":
      return { value: formatPercent(value), label: "poupança" };
    case "TOP_CATEGORY":
      return { value: formatPercent(value, { fractionDigits: 0 }), label: "das despesas" };
    case "EMERGENCY_COVERAGE":
      return { value: number1(value), label: value === 1 ? "mês de reserva" : "meses de reserva" };
    case "OVERDUE":
      return { value: String(value), label: value === 1 ? "vencido" : "vencidos" };
    default:
      return null;
  }
}
