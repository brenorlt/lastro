/**
 * Datas "de calendário" (sem horário) como strings "YYYY-MM-DD".
 * Evita o clássico bug de fuso: new Date("2026-09-24") é meia-noite UTC,
 * que no Brasil vira dia 23. Aqui tudo é construído em horário local.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export interface MonthRef {
  year: number;
  /** 0–11 */
  month: number;
}

export function currentMonth(): MonthRef {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthRange({ year, month }: MonthRef): { from: string; to: string } {
  return { from: toISODate(new Date(year, month, 1)), to: toISODate(new Date(year, month + 1, 0)) };
}

export function monthLabel({ year, month }: MonthRef, locale = "pt-BR"): string {
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isFuture(iso: string): boolean {
  return iso > todayISO();
}

/** Rótulo de agrupamento: "Hoje", "Ontem", "Amanhã" ou "qua., 24 de set.". */
export function dayLabel(iso: string, locale = "pt-BR"): string {
  const today = todayISO();
  const d = parseISODate(iso);
  const diff = Math.round((d.getTime() - parseISODate(today).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const label = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: sameYear ? undefined : "numeric" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
