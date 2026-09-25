/**
 * Datas "somente dia" como strings ISO `YYYY-MM-DD` (ordem lexicográfica = cronológica).
 * No Prisma (@db.Date) viram Date à meia-noite UTC.
 */
export type DateOnly = string;

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string') return false;
  const match = DATE_ONLY_REGEX.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "Hoje" no fuso do usuário (IANA), ex.: todayIn('America/Sao_Paulo'). */
export function todayIn(timeZone: string, now: Date = new Date()): DateOnly {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function toDbDate(value: DateOnly): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function fromDbDate(value: Date): DateOnly {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: DateOnly, days: number): DateOnly {
  const date = toDbDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDbDate(date);
}

/**
 * Soma meses mantendo o dia-âncora e limitando ao fim do mês:
 * 31/01 + 1 → 28/02 (ou 29), 31/01 + 2 → 31/03.
 */
export function addMonthsClamped(value: DateOnly, months: number, anchorDay?: number): DateOnly {
  const [year, month, day] = value.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const targetDay = Math.min(anchorDay ?? day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

// ───────────── Meses "YYYY-MM" ─────────────

export type YearMonth = string;

export function isValidYearMonth(value: unknown): value is YearMonth {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export const yearMonthOf = (date: DateOnly): YearMonth => date.slice(0, 7);
export const monthStart = (month: YearMonth): DateOnly => `${month}-01`;

export function monthEnd(month: YearMonth): DateOnly {
  const [year, m] = month.split('-').map(Number);
  return `${month}-${String(daysInMonth(year, m)).padStart(2, '0')}`;
}

export function addMonthsYm(month: YearMonth, months: number): YearMonth {
  return yearMonthOf(addMonthsClamped(monthStart(month), months));
}

/** Meses consecutivos terminando em `last` (inclusive), do mais antigo ao mais novo. */
export function monthRange(last: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, i) => addMonthsYm(last, i - count + 1));
}

/** Meses (arredondados para cima, mínimo 1) entre hoje e a data-alvo. */
export function monthsUntil(today: DateOnly, target: DateOnly): number {
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = target.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 > d1) months += 1;
  return Math.max(1, months);
}
