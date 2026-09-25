import { addDays, addMonthsClamped, type DateOnly } from '../../common/utils/date-only.js';
import type { RecurrenceFrequency } from '../../generated/prisma/enums.js';

/** Datas das parcelas: mensais a partir de `start`, com dia-âncora e ajuste ao fim do mês. */
export function installmentDates(start: DateOnly, count: number): DateOnly[] {
  const anchor = Number(start.slice(8, 10));
  return Array.from({ length: count }, (_, i) => addMonthsClamped(start, i, anchor));
}

/** k-ésima ocorrência (k = 0 é a data inicial). Mensal/anual usam dia-âncora do início. */
export function occurrenceDate(
  start: DateOnly,
  frequency: RecurrenceFrequency,
  interval: number,
  k: number,
): DateOnly {
  const anchor = Number(start.slice(8, 10));
  switch (frequency) {
    case 'DAILY':
      return addDays(start, k * interval);
    case 'WEEKLY':
      return addDays(start, k * interval * 7);
    case 'MONTHLY':
      return addMonthsClamped(start, k * interval, anchor);
    case 'YEARLY':
      return addMonthsClamped(start, k * interval * 12, anchor);
  }
}

export interface RecurrenceWindow {
  start: DateOnly;
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: DateOnly | null;
  /** Inclusivo: último dia a materializar (hoje + horizonte). */
  until: DateOnly;
  /** Exclusivo: ocorrências até esta data já existem. */
  after?: DateOnly | null;
  /** Proteção contra séries gigantes. */
  limit?: number;
}

/** Ocorrências em (after, min(until, endDate)], em ordem. */
export function recurrenceDates(window: RecurrenceWindow): DateOnly[] {
  const last = window.endDate && window.endDate < window.until ? window.endDate : window.until;
  const limit = window.limit ?? 1000;
  const dates: DateOnly[] = [];
  for (let k = 0; dates.length < limit; k++) {
    const date = occurrenceDate(window.start, window.frequency, window.interval, k);
    if (date > last) break;
    if (!window.after || date > window.after) dates.push(date);
  }
  return dates;
}

/** Próxima ocorrência estritamente depois de `after` (respeitando endDate), ou null. */
export function nextOccurrenceAfter(
  start: DateOnly,
  frequency: RecurrenceFrequency,
  interval: number,
  after: DateOnly,
  endDate?: DateOnly | null,
): DateOnly | null {
  for (let k = 0; k < 100_000; k++) {
    const date = occurrenceDate(start, frequency, interval, k);
    if (date > after) return endDate && date > endDate ? null : date;
  }
  return null;
}
