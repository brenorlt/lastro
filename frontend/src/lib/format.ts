/**
 * Formatação monetária e numérica. Valores chegam da API como string decimal
 * (ex.: "1520.40") para evitar perda de precisão; a conversão para number
 * acontece apenas na borda da exibição.
 */

export type MoneyInput = number | string;

const DEFAULT_LOCALE = "pt-BR";
const DEFAULT_CURRENCY = "BRL";

export function toNumber(value: MoneyInput): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(
  value: MoneyInput,
  options: { currency?: string; locale?: string; compact?: boolean; signed?: boolean } = {},
): string {
  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE, compact = false, signed = false } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(toNumber(value));
}

/** Separa símbolo, parte inteira e centavos para composição tipográfica. */
export function currencyParts(value: MoneyInput, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE) {
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(toNumber(value));
  const pick = (types: Intl.NumberFormatPartTypes[]) =>
    parts.filter((p) => types.includes(p.type)).map((p) => p.value).join("");
  return {
    sign: pick(["minusSign"]),
    symbol: pick(["currency"]),
    integer: pick(["integer", "group"]),
    decimal: pick(["decimal"]),
    fraction: pick(["fraction"]),
  };
}

export function formatPercent(value: number, options: { fractionDigits?: number; signed?: boolean } = {}) {
  const { fractionDigits = 1, signed = false } = options;
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value / 100);
}

export function formatDate(date: Date | string, style: "short" | "medium" | "long" = "medium") {
  const d = typeof date === "string" ? new Date(date) : date;
  const map = {
    short: { day: "2-digit", month: "2-digit" },
    medium: { day: "2-digit", month: "short", year: "numeric" },
    long: { day: "numeric", month: "long", year: "numeric" },
  } as const satisfies Record<string, Intl.DateTimeFormatOptions>;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, map[style]).format(d);
}

export function formatMonth(date: Date | string, withYear = false) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { month: "short", year: withYear ? "2-digit" : undefined })
    .format(d)
    .replace(".", "");
}
