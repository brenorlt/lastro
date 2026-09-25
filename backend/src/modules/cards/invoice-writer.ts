import { monthStart, toDbDate, type YearMonth } from '../../common/utils/date-only.js';
import { Decimal } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TransactionStatus, TransactionType } from '../../generated/prisma/enums.js';
import { type CardCycle, invoiceDates } from './invoice.calc.js';

type Tx = Prisma.TransactionClient;

export interface InvoiceRelevant {
  type: TransactionType;
  status: TransactionStatus;
  amount: Decimal | string;
  creditCardId: string | null;
  invoiceId: string | null;
}

export interface InvoiceEffect {
  total: Decimal;
  paid: Decimal;
}

/**
 * Efeito nas faturas: compra (EXPENSE no cartão) soma no total, independente do status;
 * pagamento (TRANSFER com invoiceId) soma no pago apenas quando CLEARED.
 */
export function invoiceEffects(tx: InvoiceRelevant): Map<string, InvoiceEffect> {
  const effects = new Map<string, InvoiceEffect>();
  if (!tx.invoiceId) return effects;
  const amount = new Decimal(tx.amount);
  if (tx.type === 'EXPENSE' && tx.creditCardId) {
    effects.set(tx.invoiceId, { total: amount, paid: new Decimal(0) });
  } else if (tx.type === 'TRANSFER' && tx.status === 'CLEARED') {
    effects.set(tx.invoiceId, { total: new Decimal(0), paid: amount });
  }
  return effects;
}

export function invoiceDelta(
  ...pairs: [InvoiceRelevant | null, InvoiceRelevant | null][]
): Map<string, InvoiceEffect> {
  const delta = new Map<string, InvoiceEffect>();
  const merge = (effects: Map<string, InvoiceEffect>, sign: 1 | -1) => {
    for (const [id, e] of effects) {
      const cur = delta.get(id) ?? { total: new Decimal(0), paid: new Decimal(0) };
      delta.set(id, {
        total: cur.total.plus(sign === 1 ? e.total : e.total.neg()),
        paid: cur.paid.plus(sign === 1 ? e.paid : e.paid.neg()),
      });
    }
  };
  for (const [before, after] of pairs) {
    if (before) merge(invoiceEffects(before), -1);
    if (after) merge(invoiceEffects(after), 1);
  }
  for (const [id, e] of delta) if (e.total.isZero() && e.paid.isZero()) delta.delete(id);
  return delta;
}

/** Aplica deltas de total/pago com increment atômico. */
export async function applyInvoiceDelta(tx: Tx, delta: Map<string, InvoiceEffect>): Promise<void> {
  for (const [id, e] of delta) {
    await tx.creditCardInvoice.update({
      where: { id },
      data: { total: { increment: e.total }, paidAmount: { increment: e.paid } },
    });
  }
}

/** Garante a fatura (cartão, mês de referência) persistida e retorna o id (upsert preguiçoso). */
export async function ensureInvoice(
  tx: Tx,
  card: CardCycle & { id: string; userId: string },
  referenceMonth: YearMonth,
): Promise<string> {
  const { closingDate, dueDate } = invoiceDates(card, referenceMonth);
  const invoice = await tx.creditCardInvoice.upsert({
    where: {
      cardId_referenceMonth: {
        cardId: card.id,
        referenceMonth: toDbDate(monthStart(referenceMonth)),
      },
    },
    create: {
      userId: card.userId,
      cardId: card.id,
      referenceMonth: toDbDate(monthStart(referenceMonth)),
      closingDate: toDbDate(closingDate),
      dueDate: toDbDate(dueDate),
    },
    update: {},
    select: { id: true },
  });
  return invoice.id;
}
