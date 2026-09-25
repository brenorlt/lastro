import { toISODate } from "@/lib/dates";

export type PresetKey = "this-month" | "last-month" | "last-3" | "last-6" | "last-12" | "this-year" | "last-year" | "custom";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "Este mês" },
  { key: "last-month", label: "Mês passado" },
  { key: "last-3", label: "Últimos 3 meses" },
  { key: "last-6", label: "Últimos 6 meses" },
  { key: "last-12", label: "Últimos 12 meses" },
  { key: "this-year", label: "Este ano" },
  { key: "last-year", label: "Ano passado" },
  { key: "custom", label: "Personalizado" },
];

/** Intervalos fechados em meses de calendário ("últimos 3" = este mês e os 2 anteriores). */
export function presetRange(key: Exclude<PresetKey, "custom">, today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const monthEnd = (yy: number, mm: number) => toISODate(new Date(yy, mm + 1, 0));
  const monthStart = (yy: number, mm: number) => toISODate(new Date(yy, mm, 1));
  switch (key) {
    case "this-month":
      return { from: monthStart(y, m), to: monthEnd(y, m) };
    case "last-month":
      return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) };
    case "last-3":
      return { from: monthStart(y, m - 2), to: monthEnd(y, m) };
    case "last-6":
      return { from: monthStart(y, m - 5), to: monthEnd(y, m) };
    case "last-12":
      return { from: monthStart(y, m - 11), to: monthEnd(y, m) };
    case "this-year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last-year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function periodLabel(from: string, to: string, locale = "pt-BR") {
  const f = (s: string) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${s}T12:00:00`));
  return `${f(from)} – ${f(to)}`;
}
