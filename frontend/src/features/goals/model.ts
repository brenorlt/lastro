import { parseISODate, todayISO } from "@/lib/dates";

/** Meses inteiros do mês atual até o mês da data-alvo (mínimo 1 se no futuro). Espelha a API. */
export function monthsUntil(targetDate: string, today = todayISO()): number {
  if (targetDate <= today) return 0;
  const t = parseISODate(targetDate);
  const n = parseISODate(today);
  return Math.max(1, (t.getFullYear() - n.getFullYear()) * 12 + (t.getMonth() - n.getMonth()));
}

/** Aporte mensal necessário, arredondado para cima em centavos (nunca promete menos do que precisa). */
export function requiredMonthly(target: number, current: number, months: number): number | null {
  if (months <= 0) return null;
  const remainingCents = Math.max(0, Math.round((target - current) * 100));
  return Math.ceil(remainingCents / months) / 100;
}

export function monthYear(iso: string, locale = "pt-BR") {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(parseISODate(iso)).replace(".", "");
}
