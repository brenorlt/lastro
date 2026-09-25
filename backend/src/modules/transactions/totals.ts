import { Prisma } from '../../generated/prisma/client.js';
import type { TransactionStatus, TransactionType } from '../../generated/prisma/enums.js';
import { toMoneyString } from '../../common/utils/money.js';

export interface TotalsRow {
  type: TransactionType;
  status: TransactionStatus;
  count: number;
  sum: Prisma.Decimal | null;
}

export interface TransactionTotals {
  income: string;
  expense: string;
  net: string;
  pendingIncome: string;
  pendingExpense: string;
}

/** Totais do conjunto filtrado a partir de um groupBy (type, status). Transferências são neutras. */
export function computeTotals(rows: TotalsRow[]): { total: number; totals: TransactionTotals } {
  const zero = () => new Prisma.Decimal(0);
  let income = zero();
  let expense = zero();
  let pendingIncome = zero();
  let pendingExpense = zero();
  let total = 0;
  for (const row of rows) {
    total += row.count;
    const sum = row.sum ?? zero();
    if (row.type === 'INCOME') {
      income = income.plus(sum);
      if (row.status === 'PENDING') pendingIncome = pendingIncome.plus(sum);
    } else if (row.type === 'EXPENSE') {
      expense = expense.plus(sum);
      if (row.status === 'PENDING') pendingExpense = pendingExpense.plus(sum);
    }
  }
  return {
    total,
    totals: {
      income: toMoneyString(income),
      expense: toMoneyString(expense),
      net: toMoneyString(income.minus(expense)),
      pendingIncome: toMoneyString(pendingIncome),
      pendingExpense: toMoneyString(pendingExpense),
    },
  };
}
