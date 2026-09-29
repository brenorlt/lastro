import { Badge } from "@/components/ui/primitives";
import { isFuture } from "@/lib/dates";
import type { Transaction, TransactionStatus } from "@/types/finance";

export type PaymentStatusKind = "paid" | "scheduled" | "unpaid";

/** Situação real (pago) x inferida pela data: agendado (futuro) x não pago (hoje ou atrasado). */
export function paymentStatusKind(t: { status: TransactionStatus; date: string }): PaymentStatusKind {
  if (t.status !== "PENDING") return "paid";
  return isFuture(t.date) ? "scheduled" : "unpaid";
}

/** Badge único de situação de pagamento, usado em toda a UI para não divergir cor/texto entre telas. */
export function PaymentStatusBadge({
  transaction: t,
  className,
}: {
  transaction: Pick<Transaction, "status" | "date" | "type">;
  className?: string;
}) {
  const kind = paymentStatusKind(t);
  if (kind === "paid") return null;
  const label = kind === "scheduled" ? "Agendado" : t.type === "INCOME" ? "A receber" : "A pagar";
  return (
    <Badge tone={kind === "scheduled" ? "accent" : "negative"} className={className}>
      {label}
    </Badge>
  );
}
