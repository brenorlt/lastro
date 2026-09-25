"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { LineChart } from "@/components/charts/charts";
import { Amount } from "@/components/finance/amount";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { shortMonth } from "@/features/dashboard/api";
import { AccountSelect } from "@/features/transactions/components/entity-selects";
import { cn } from "@/lib/cn";
import { dayLabel, todayISO } from "@/lib/dates";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { InvestmentTxType } from "@/types/wealth";
import { investmentTypeLabel, TX_TYPES, useAddInvestmentTx, useInvestment, useRemoveInvestmentTx } from "../api";

function TxForm({ id, byQuantity }: { id: string; byQuantity: boolean }) {
  const add = useAddInvestmentTx();
  const [type, setType] = useState<InvestmentTxType>("BUY");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = TX_TYPES.find((t) => t.value === type)!;
  const withQty = byQuantity && (type === "BUY" || type === "SELL");

  const submit = async () => {
    setError(null);
    if (amount === "" || amount === "invalid" || toNumber(amount) <= 0) return setError("Informe o valor.");
    try {
      await add.mutateAsync({
        id,
        input: { type, amount, date, quantity: withQty && quantity ? quantity.replace(",", ".") : null, accountId: meta.cash ? accountId : null },
      });
      setAmount("");
      setQuantity("");
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <div className="space-y-4 rounded-lg p-4 ring-1 ring-line">
      <Field label="Movimentação">
        <Select value={type} onValueChange={(v) => setType(v as InvestmentTxType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label} — {t.hint}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "VALUATION" ? "Valor total atual" : type === "SELL" ? "Valor recebido" : "Valor"}><MoneyInput value={amount} onChange={setAmount} /></Field>
        {withQty ? (
          <Field label="Quantidade"><Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ""))} className="num" /></Field>
        ) : (
          <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        )}
      </div>
      {withQty && <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
      {meta.cash && (
        <Field label={meta.cash === "out" ? "Saiu da conta" : "Caiu na conta"} optional hint="Opcional: atualiza o saldo da conta e seu fluxo de caixa.">
          <AccountSelect value={accountId} onChange={setAccountId} allLabel="Não movimentar conta" />
        </Field>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      <Button className="w-full" loading={add.isPending} onClick={() => void submit()}>Registrar {meta.label.toLowerCase()}</Button>
    </div>
  );
}

export function InvestmentDetailDrawer({ id, onOpenChange }: { id: string | null; onOpenChange: (v: boolean) => void }) {
  const q = useInvestment(id);
  const removeTx = useRemoveInvestmentTx();
  const i = q.data;
  const profit = i ? toNumber(i.profit) : 0;

  return (
    <Dialog open={id !== null} onOpenChange={onOpenChange}>
      <DrawerContent title={i ? `${i.name}${i.ticker ? ` · ${i.ticker}` : ""}` : "Investimento"} description={i ? `${investmentTypeLabel(i.type)}${i.institution ? ` · ${i.institution}` : ""}` : undefined} className="sm:w-[520px]">
        {q.isPending ? (
          <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 w-40" /><Skeleton className="h-40 w-full" /></div>
        ) : q.isError || !i ? (
          <ErrorState description={userMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <div className="space-y-7">
            <div>
              <Amount value={i.currentValue} className="text-3xl font-semibold tracking-tight text-ink" />
              <p className={cn("num mt-1 text-sm font-medium", profit >= 0 ? "text-positive" : "text-negative")}>
                {profit >= 0 ? "+" : "−"}{formatCurrency(Math.abs(profit))}
                {i.profitPercent !== null && ` (${formatPercent(i.profitPercent, { signed: true })})`}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-ink-3">Valor aplicado</dt><dd className="num font-medium text-ink">{formatCurrency(i.investedAmount)}</dd></div>
                <div><dt className="text-ink-3">Proventos líquidos</dt><dd className="num font-medium text-ink">{formatCurrency(i.income)}</dd></div>
                {i.quantity && <div><dt className="text-ink-3">Quantidade</dt><dd className="num font-medium text-ink">{Number(i.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</dd></div>}
                {i.averagePrice && <div><dt className="text-ink-3">Preço médio</dt><dd className="num font-medium text-ink">{formatCurrency(i.averagePrice)}</dd></div>}
                {i.maturityDate && <div><dt className="text-ink-3">Vencimento</dt><dd className="font-medium text-ink">{dayLabel(i.maturityDate)}</dd></div>}
                <div><dt className="text-ink-3">Última atualização</dt><dd className="font-medium text-ink">{i.lastValuationAt ? dayLabel(i.lastValuationAt.slice(0, 10)) : "—"}</dd></div>
              </dl>
              <p className="mt-3 text-2xs text-ink-3">Rentabilidade = valor atual − aplicado + proventos. Atualize o valor periodicamente para mantê-la real.</p>
            </div>

            {i.series.some((p) => toNumber(p.value) > 0) && (
              <LineChart
                data={i.series.map((p) => ({ month: shortMonth(p.month), valor: toNumber(p.value), aplicado: toNumber(p.invested) }))}
                xKey="month"
                domain={["auto", "auto"]}
                series={[{ key: "valor", label: "Valor", color: "var(--series-1)" }, { key: "aplicado", label: "Aplicado", color: "var(--ink-3)", dashed: true }]}
                ariaLabel={`Valor e custo de ${i.name} nos últimos 12 meses`}
                height={170}
              />
            )}

            <TxForm id={i.id} byQuantity={Boolean(i.quantity)} />

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Histórico</p>
              <ul className="divide-y divide-line">
                {i.transactions.map((t) => {
                  const meta = TX_TYPES.find((x) => x.value === t.type);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{meta?.label ?? t.type}{t.quantity ? ` · ${Number(t.quantity).toLocaleString("pt-BR")} un.` : ""}</p>
                        <p className="text-xs text-ink-3">{dayLabel(t.date)}{t.account ? ` · ${t.account.name}` : ""}</p>
                      </div>
                      <Amount value={t.amount} className="text-sm font-medium" />
                      <IconButton label="Remover movimentação" size="icon-sm" onClick={() => removeTx.mutate({ id: i.id, tid: t.id })}><Trash2 /></IconButton>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </DrawerContent>
    </Dialog>
  );
}
