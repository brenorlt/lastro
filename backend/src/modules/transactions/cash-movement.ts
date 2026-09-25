import { type DateOnly, toDbDate } from '../../common/utils/date-only.js';
import { Decimal } from '../../common/utils/money.js';
import { transactionSearchText } from '../../common/utils/search-text.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { balanceDelta } from './balance.js';
import { applyBalanceDelta } from './balance-writer.js';

type Tx = Prisma.TransactionClient;

/**
 * Movimento de caixa gerado por outro módulo (investimentos, dívidas), sempre CLEARED:
 * - OUT: TRANSFER saindo da conta (aplicação, aporte, pagamento de dívida) — neutro no fluxo;
 * - IN: TRANSFER entrando na conta (resgate) — neutro no fluxo;
 * - INCOME / EXPENSE: rendimentos e taxas, que contam no fluxo de caixa.
 */
export async function createCashMovement(
  tx: Tx,
  input: {
    userId: string;
    kind: 'OUT' | 'IN' | 'INCOME' | 'EXPENSE';
    accountId: string;
    amount: Decimal;
    date: DateOnly;
    description: string;
    categoryId?: string | null;
  },
): Promise<string> {
  const type =
    input.kind === 'INCOME' ? 'INCOME' : input.kind === 'EXPENSE' ? 'EXPENSE' : 'TRANSFER';
  const row = await tx.transaction.create({
    data: {
      userId: input.userId,
      type,
      amount: input.amount,
      description: input.description.slice(0, 120),
      searchText: transactionSearchText(input.description, null),
      date: toDbDate(input.date),
      status: 'CLEARED',
      accountId: input.kind === 'IN' ? null : input.accountId,
      transferAccountId: input.kind === 'IN' ? input.accountId : null,
      categoryId: input.categoryId ?? null,
    },
  });
  await applyBalanceDelta(tx, balanceDelta(null, row));
  return row.id;
}

/** Remove o movimento e desfaz o efeito no saldo (se ainda existir). */
export async function deleteCashMovement(tx: Tx, transactionId: string | null): Promise<void> {
  if (!transactionId) return;
  const row = await tx.transaction.findUnique({ where: { id: transactionId } });
  if (!row) return;
  await tx.transaction.delete({ where: { id: transactionId } });
  await applyBalanceDelta(tx, balanceDelta(row, null));
}
