import { fromDbDate } from '../../common/utils/date-only.js';
import { toMoneyString } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TransactionDto } from './dto/transaction.dto.js';

const ACCOUNT_REF = { select: { id: true, name: true, color: true, icon: true } } as const;

/** Include único usado em todas as leituras (sem N+1). */
export const TRANSACTION_INCLUDE = {
  account: ACCOUNT_REF,
  transferAccount: ACCOUNT_REF,
  category: { select: { id: true, name: true, color: true, icon: true, parentId: true } },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
  creditCard: { select: { id: true, name: true, color: true, brand: true, lastFourDigits: true } },
  invoice: { select: { id: true, referenceMonth: true, dueDate: true } },
  recurringTransaction: {
    select: { id: true, frequency: true, interval: true, endDate: true, active: true },
  },
} satisfies Prisma.TransactionInclude;

export type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: typeof TRANSACTION_INCLUDE;
}>;

export function toTransactionDto(row: TransactionWithRelations): TransactionDto {
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
  return {
    id: row.id,
    type: row.type,
    amount: toMoneyString(row.amount),
    description: row.description,
    date: fromDbDate(row.date),
    // SCHEDULED não é exposto na API: futuro pendente = agendado.
    status: row.status === 'CLEARED' ? 'CLEARED' : 'PENDING',
    notes: row.notes,
    account: row.account,
    transferAccount: row.transferAccount,
    category: row.category,
    categoryAuto: row.category !== null && row.categoryAuto,
    tags: row.tags.map((t) => t.tag).sort((a, b) => collator.compare(a.name, b.name)),
    creditCard: row.creditCard,
    invoice: row.invoice
      ? {
          id: row.invoice.id,
          referenceMonth: fromDbDate(row.invoice.referenceMonth).slice(0, 7),
          dueDate: fromDbDate(row.invoice.dueDate),
        }
      : null,
    installment:
      row.installmentGroupId && row.installmentNumber && row.installmentTotal
        ? {
            groupId: row.installmentGroupId,
            number: row.installmentNumber,
            total: row.installmentTotal,
          }
        : null,
    recurring: row.recurringTransaction
      ? {
          id: row.recurringTransaction.id,
          frequency: row.recurringTransaction.frequency,
          interval: row.recurringTransaction.interval,
          endDate: row.recurringTransaction.endDate
            ? fromDbDate(row.recurringTransaction.endDate)
            : null,
          active: row.recurringTransaction.active,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
