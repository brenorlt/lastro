import {
  addMonthsYm,
  type DateOnly,
  daysInMonth,
  type YearMonth,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal } from '../../common/utils/money.js';

export interface CardCycle {
  closingDay: number;
  dueDay: number;
}

export type InvoiceStatusValue = 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';

/** Dia `day` do mês, limitado ao último dia (31 em fevereiro → 28/29). */
export function clampDay(month: YearMonth, day: number): DateOnly {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, '0')}`;
}

/**
 * Fatura identificada pelo mês do VENCIMENTO. O fechamento cai no mesmo mês se
 * closingDay < dueDay; caso contrário, no mês anterior.
 */
export function invoiceDates(
  card: CardCycle,
  referenceMonth: YearMonth,
): { closingDate: DateOnly; dueDate: DateOnly } {
  const dueDate = clampDay(referenceMonth, card.dueDay);
  const closingMonth =
    card.closingDay < card.dueDay ? referenceMonth : addMonthsYm(referenceMonth, -1);
  return { closingDate: clampDay(closingMonth, card.closingDay), dueDate };
}

/**
 * Fatura de uma compra: a primeira cujo fechamento é ESTRITAMENTE posterior à data
 * (compra no dia do fechamento já vai para a próxima — "melhor dia de compra").
 */
export function invoiceFor(card: CardCycle, date: DateOnly): YearMonth {
  const base = yearMonthOf(date);
  for (let offset = -1; offset <= 3; offset++) {
    const ref = addMonthsYm(base, offset);
    if (invoiceDates(card, ref).closingDate > date) return ref;
  }
  return addMonthsYm(base, 3);
}

export function invoiceStatus(
  invoice: { closingDate: DateOnly; dueDate: DateOnly; total: Decimal; paidAmount: Decimal },
  today: DateOnly,
): InvoiceStatusValue {
  const remaining = invoice.total.minus(invoice.paidAmount);
  const closed = today >= invoice.closingDate;
  if (today > invoice.dueDate && remaining.greaterThan(0)) return 'OVERDUE';
  if (remaining.lessThanOrEqualTo(0) && (closed || invoice.total.greaterThan(0))) return 'PAID';
  if (!closed) return 'OPEN';
  return 'CLOSED';
}

/** Limite comprometido: Σ max(total − pago, 0) de todas as faturas (inclui parcelas futuras). */
export function limitUsage(limit: Decimal, invoices: { total: Decimal; paidAmount: Decimal }[]) {
  const used = invoices.reduce(
    (acc, inv) => acc.plus(Decimal.max(inv.total.minus(inv.paidAmount), 0)),
    new Decimal(0),
  );
  const available = limit.minus(used);
  return {
    limitUsed: used,
    availableLimit: available,
    usagePercent: limit.greaterThan(0)
      ? Number(used.div(limit).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1))
      : 0,
    overLimit: available.lessThan(0),
  };
}

const MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** "2026-09" → "set/2026". */
export function monthLabel(month: YearMonth): string {
  return `${MONTHS_PT[Number(month.slice(5, 7)) - 1]}/${month.slice(0, 4)}`;
}
