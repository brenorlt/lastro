import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  addDays,
  addMonthsYm,
  type DateOnly,
  fromDbDate,
  monthEnd,
  monthStart,
  toDbDate,
  type YearMonth,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { monthLabel } from '../cards/invoice.calc.js';
import { isoWeek } from '../notifications/notification-rules.js';

export type Granularity = 'day' | 'week' | 'month';
export const MAX_SPAN_DAYS = 1827; // 5 anos
export const MAX_DAILY_SPAN_DAYS = 92;

const fail = (field: string, message: string) =>
  new AppException(ErrorCode.VALIDATION_ERROR, { details: [{ field, message }] });

export const daysBetween = (from: DateOnly, to: DateOnly) =>
  Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / 86_400_000) + 1;

/** Intervalo do relatório: padrão = mês atual; `from` ≤ `to`; no máximo 5 anos. */
export function resolveRange(
  from: DateOnly | undefined,
  to: DateOnly | undefined,
  today: DateOnly,
) {
  const month = yearMonthOf(today);
  const start = from ?? (to ? monthStart(yearMonthOf(to)) : monthStart(month));
  const end = to ?? (from ? monthEnd(yearMonthOf(from)) : monthEnd(month));
  if (start > end) throw fail('from', 'A data inicial deve ser anterior à final');
  if (daysBetween(start, end) > MAX_SPAN_DAYS) throw fail('to', 'O período máximo é de 5 anos');
  return { from: start, to: end };
}

/** Janela de mesmo tamanho imediatamente anterior. */
export function previousWindow(from: DateOnly, to: DateOnly) {
  const length = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  return { from: addDays(prevTo, -(length - 1)), to: prevTo };
}

/** Dia só é permitido até 92 dias; acima disso cai para mês. */
export function effectiveGranularity(
  requested: Granularity,
  from: DateOnly,
  to: DateOnly,
): Granularity {
  return requested === 'day' && daysBetween(from, to) > MAX_DAILY_SPAN_DAYS ? 'month' : requested;
}

export function periodKey(date: DateOnly, granularity: Granularity): string {
  if (granularity === 'day') return date;
  if (granularity === 'week') return isoWeek(date);
  return yearMonthOf(date);
}

/** Todos os períodos do intervalo (para preencher com zeros), em ordem. */
export function enumeratePeriods(from: DateOnly, to: DateOnly, granularity: Granularity) {
  const periods: { period: string; label: string; start: DateOnly }[] = [];
  const seen = new Set<string>();
  if (granularity === 'month') {
    for (let m: YearMonth = yearMonthOf(from); m <= yearMonthOf(to); m = addMonthsYm(m, 1)) {
      periods.push({ period: m, label: monthLabel(m), start: monthStart(m) });
    }
    return periods;
  }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = periodKey(d, granularity);
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push({
      period: key,
      label:
        granularity === 'day'
          ? `${d.slice(8, 10)}/${d.slice(5, 7)}`
          : `Sem. ${key.slice(6)} (${d.slice(8, 10)}/${d.slice(5, 7)})`,
      start: d,
    });
  }
  return periods;
}

/**
 * Meses de calendário cobertos pelo intervalo, para médias mensais. Meses inteiros contam 1;
 * meses parciais contam a fração de dias cobertos (1–30/set = 1; 16–30/set = 0,5).
 * Dividir por dias/30,44 distorcia médias de meses completos (3 salários de 8.000 → 7.940).
 */
export function monthsSpanned(from: DateOnly, to: DateOnly): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0;
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((m = 1), y++) : m++) {
    const dim = daysIn(y, m);
    const start = y === fy && m === fm ? fd : 1;
    const end = y === ty && m === tm ? td : dim;
    total += (end - start + 1) / dim;
  }
  return Math.max(1, total);
}

export const dateOf = (value: Date) => fromDbDate(value);
