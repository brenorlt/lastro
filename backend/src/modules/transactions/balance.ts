import { Prisma } from '../../generated/prisma/client.js';
import type { TransactionStatus, TransactionType } from '../../generated/prisma/enums.js';

export interface BalanceRelevant {
  type: TransactionType;
  status: TransactionStatus;
  amount: Prisma.Decimal | string;
  accountId: string | null;
  transferAccountId: string | null;
}

/** Efeito de um lançamento nos saldos: só CLEARED conta. */
export function balanceEffects(tx: BalanceRelevant): Map<string, Prisma.Decimal> {
  const effects = new Map<string, Prisma.Decimal>();
  if (tx.status !== 'CLEARED') return effects;
  const amount = new Prisma.Decimal(tx.amount);
  const add = (accountId: string | null, value: Prisma.Decimal) => {
    if (!accountId) return;
    effects.set(accountId, (effects.get(accountId) ?? new Prisma.Decimal(0)).plus(value));
  };
  switch (tx.type) {
    case 'INCOME':
      add(tx.accountId, amount);
      break;
    case 'EXPENSE':
      add(tx.accountId, amount.neg());
      break;
    case 'TRANSFER':
      add(tx.accountId, amount.neg());
      add(tx.transferAccountId, amount);
      break;
  }
  return effects;
}

/** Deltas por conta para ir de `before` a `after` (null = inexistente). Zeros omitidos. */
export function balanceDelta(
  before: BalanceRelevant | null,
  after: BalanceRelevant | null,
): Map<string, Prisma.Decimal> {
  const delta = new Map<string, Prisma.Decimal>();
  const merge = (effects: Map<string, Prisma.Decimal>, sign: 1 | -1) => {
    for (const [id, value] of effects) {
      delta.set(
        id,
        (delta.get(id) ?? new Prisma.Decimal(0)).plus(sign === 1 ? value : value.neg()),
      );
    }
  };
  if (before) merge(balanceEffects(before), -1);
  if (after) merge(balanceEffects(after), 1);
  for (const [id, value] of delta) if (value.isZero()) delta.delete(id);
  return delta;
}

/** Soma vários deltas (ex.: uma edição em série). */
export function mergeDeltas(...deltas: Map<string, Prisma.Decimal>[]): Map<string, Prisma.Decimal> {
  const total = new Map<string, Prisma.Decimal>();
  for (const delta of deltas) {
    for (const [id, value] of delta) {
      total.set(id, (total.get(id) ?? new Prisma.Decimal(0)).plus(value));
    }
  }
  for (const [id, value] of total) if (value.isZero()) total.delete(id);
  return total;
}

/**
 * Invariante: saldo = inicial + Σ receitas − Σ despesas − Σ transferências enviadas
 * + Σ transferências recebidas (apenas CLEARED).
 */
export function expectedBalance(
  accountId: string,
  initialBalance: Prisma.Decimal | string,
  transactions: BalanceRelevant[],
): Prisma.Decimal {
  let balance = new Prisma.Decimal(initialBalance);
  for (const tx of transactions) {
    balance = balance.plus(balanceEffects(tx).get(accountId) ?? 0);
  }
  return balance;
}
