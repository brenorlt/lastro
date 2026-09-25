"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AreaChart } from "@/components/charts/charts";
import { Amount } from "@/components/finance/amount";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/pickers";
import { Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/ui/states";
import { shortMonth } from "@/features/dashboard/api";
import { dayLabel, todayISO } from "@/lib/dates";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useContribute, useGoal, useRemoveContribution } from "../api";
import { monthYear } from "../model";

function ContributionForm({ goalId }: { goalId: string }) {
  const contribute = useContribute();
  const [kind, setKind] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valid = amount !== "" && amount !== "invalid" && Number(amount) > 0;

  const submit = async () => {
    setError(null);
    try {
      await contribute.mutateAsync({ id: goalId, input: { amount: kind === "OUT" ? `-${amount}` : amount, date, note: note.trim() || null } });
      setAmount("");
      setNote("");
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <div className="space-y-4 rounded-lg p-4 ring-1 ring-line">
      <SegmentedControl<"IN" | "OUT"> label="Tipo de movimentação" value={kind} onChange={setKind} options={[{ value: "IN", label: "Aporte" }, { value: "OUT", label: "Resgate" }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label="Observação" optional><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: 13º salário" /></Field>
      {error && <FormAlert>{error}</FormAlert>}
      <Button className="w-full" disabled={!valid} loading={contribute.isPending} onClick={() => void submit()}>
        {kind === "IN" ? "Registrar aporte" : "Registrar resgate"}
      </Button>
      <p className="text-xs text-ink-3">O dinheiro continua na sua conta: aqui você marca quanto dele já é desta meta.</p>
    </div>
  );
}

export function GoalDetailDrawer({ goalId, onOpenChange }: { goalId: string | null; onOpenChange: (v: boolean) => void }) {
  const query = useGoal(goalId);
  const remove = useRemoveContribution();
  const g = query.data;

  return (
    <Dialog open={goalId !== null} onOpenChange={onOpenChange}>
      <DrawerContent title={g?.name ?? "Meta"} description={g?.targetDate ? `Prazo: ${monthYear(g.targetDate)}` : "Sem prazo definido"} className="sm:w-[520px]">
        {query.isPending ? (
          <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 w-40" /><Skeleton className="h-2 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : query.isError || !g ? (
          <ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <div className="space-y-7">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Amount value={g.currentAmount} className="text-3xl font-semibold tracking-tight text-ink" />
                <span className="num text-sm text-ink-2">{formatPercent(g.progress, { fractionDigits: 1 })}</span>
              </div>
              <Progress value={toNumber(g.currentAmount)} max={Math.max(toNumber(g.targetAmount), 1)} tone={g.status === "COMPLETED" ? "positive" : "accent"} label="Progresso da meta" />
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-ink-3">Objetivo</dt><dd className="num font-medium text-ink">{formatCurrency(g.targetAmount)}</dd></div>
                <div><dt className="text-ink-3">Falta</dt><dd className="num font-medium text-ink">{formatCurrency(g.remaining)}</dd></div>
                {g.requiredMonthly && <div><dt className="text-ink-3">Necessário por mês</dt><dd className="num font-medium text-ink">{formatCurrency(g.requiredMonthly)}</dd></div>}
                {g.projectedCompletionDate && <div><dt className="text-ink-3">Previsão no ritmo atual</dt><dd className="font-medium text-ink">{monthYear(g.projectedCompletionDate)}</dd></div>}
              </dl>
            </div>

            {g.series.some((p) => toNumber(p.saved) > 0) && (
              <div>
                <p className="mb-2 text-sm font-medium text-ink">Evolução</p>
                <AreaChart
                  data={g.series.map((p) => ({ month: shortMonth(p.month), guardado: toNumber(p.saved) }))}
                  xKey="month"
                  series={[{ key: "guardado", label: "Guardado", color: g.color }]}
                  ariaLabel={`Valor guardado para ${g.name} nos últimos 12 meses`}
                  height={160}
                />
              </div>
            )}

            {g.status !== "ARCHIVED" && <ContributionForm goalId={g.id} />}

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Movimentações</p>
              {g.contributions.length === 0 ? (
                <p className="text-sm text-ink-3">Nenhum aporte ainda.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {g.contributions.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{c.note ?? (c.amount.startsWith("-") ? "Resgate" : "Aporte")}</p>
                        <p className="text-xs text-ink-3">{dayLabel(c.date)}</p>
                      </div>
                      <Amount value={c.amount.replace("-", "")} flow={c.amount.startsWith("-") ? "expense" : "income"} className="text-sm font-medium" />
                      <IconButton label="Remover movimentação" size="icon-sm" onClick={() => remove.mutate({ id: g.id, cid: c.id })}><Trash2 /></IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DrawerContent>
    </Dialog>
  );
}
