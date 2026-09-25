import { addDays, type DateOnly, toDbDate } from '../../common/utils/date-only.js';

export type BillStage = 'IN_3_DAYS' | 'TODAY' | 'YESTERDAY';
export type InvoiceStage = 'IN_5_DAYS' | 'DUE_TODAY' | 'OVERDUE' | 'CLOSED_TODAY';

/** Estágio do aviso de conta a pagar (pendente, fora de cartão) conforme a data. */
export function billStage(date: DateOnly, today: DateOnly): BillStage | null {
  if (date === addDays(today, 3)) return 'IN_3_DAYS';
  if (date === today) return 'TODAY';
  if (date === addDays(today, -1)) return 'YESTERDAY';
  return null;
}

/** Estágios de aviso da fatura hoje (pode haver fechamento e vencimento no mesmo dia). */
export function invoiceStages(
  invoice: { closingDate: DateOnly; dueDate: DateOnly; hasRemaining: boolean; total: number },
  today: DateOnly,
): InvoiceStage[] {
  const stages: InvoiceStage[] = [];
  if (invoice.closingDate === today && invoice.total > 0) stages.push('CLOSED_TODAY');
  if (!invoice.hasRemaining) return stages;
  if (invoice.dueDate === addDays(today, 5)) stages.push('IN_5_DAYS');
  if (invoice.dueDate === today) stages.push('DUE_TODAY');
  if (invoice.dueDate === addDays(today, -1)) stages.push('OVERDUE'); // primeiro dia em atraso
  return stages;
}

export const weekday = (date: DateOnly) => toDbDate(date).getUTCDay(); // 0 = domingo
export const isMonday = (date: DateOnly) => weekday(date) === 1;
export const isFirstOfMonth = (date: DateOnly) => date.endsWith('-01');

/** Semana ISO ("YYYY-Www") de uma data. */
export function isoWeek(date: DateOnly): string {
  const d = toDbDate(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // quinta-feira da mesma semana
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Segunda a domingo da semana anterior a `today`. */
export function previousWeek(today: DateOnly): { from: DateOnly; to: DateOnly; week: string } {
  const offset = (weekday(today) + 6) % 7; // dias desde a segunda
  const from = addDays(today, -offset - 7);
  const to = addDays(from, 6);
  return { from, to, week: isoWeek(from) };
}

/** Pode enviar de novo? (no máximo uma vez a cada `days` dias). */
export function cooledDown(last: Date | null, now: Date, days: number): boolean {
  return !last || now.getTime() - last.getTime() >= days * 86_400_000;
}
