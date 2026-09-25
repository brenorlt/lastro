"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { AccountSelect } from "@/features/transactions/components/entity-selects";
import { todayISO } from "@/lib/dates";
import { formatCurrency, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { CreditCard, InvoiceSummary } from "@/types/cards";
import { usePayInvoice } from "../api";
import { monthYear } from "@/features/goals/model";

export function PayInvoiceDialog({ card, invoice, onOpenChange }: { card: CreditCard; invoice: InvoiceSummary; onOpenChange: (v: boolean) => void }) {
  const pay = usePayInvoice();
  const [accountId, setAccountId] = useState<string | null>(card.paymentAccount?.id ?? null);
  const [amount, setAmount] = useState(invoice.remaining);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const partial = amount !== "" && amount !== "invalid" && toNumber(amount) < toNumber(invoice.remaining);

  const submit = async () => {
    setError(null);
    if (!accountId) return setError("Escolha a conta que paga a fatura.");
    if (amount === "" || amount === "invalid" || toNumber(amount) <= 0) return setError("Informe o valor do pagamento.");
    try {
      await pay.mutateAsync({ id: card.id, ref: invoice.referenceMonth, input: { accountId, amount, date } });
      onOpenChange(false);
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={`Pagar fatura de ${monthYear(`${invoice.referenceMonth}-01`)}`}
        description={`${card.name} · restante ${formatCurrency(invoice.remaining)}`}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button loading={pay.isPending} onClick={() => void submit()}>{partial ? "Registrar pagamento parcial" : "Pagar fatura"}</Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Pagar com"><AccountSelect value={accountId} onChange={setAccountId} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Valor" hint={partial ? "O restante continua na fatura e pode gerar juros no banco." : undefined}>
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <p className="text-xs text-ink-3">O pagamento sai da conta escolhida e não conta como nova despesa: as compras já foram registradas quando aconteceram.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
