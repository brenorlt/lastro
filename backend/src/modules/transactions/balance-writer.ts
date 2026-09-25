import type { Prisma } from '../../generated/prisma/client.js';

/** Aplica deltas de saldo com increment atômico (nunca read-modify-write). */
export async function applyBalanceDelta(
  tx: Prisma.TransactionClient,
  delta: Map<string, Prisma.Decimal>,
): Promise<void> {
  for (const [accountId, value] of delta) {
    if (value.isZero()) continue;
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: { increment: value } },
    });
  }
}
