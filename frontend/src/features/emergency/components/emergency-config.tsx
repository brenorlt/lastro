"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DrawerContent } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/pickers";
import { Switch } from "@/components/ui/switch";
import { AccountSelect } from "@/features/transactions/components/entity-selects";
import { cn } from "@/lib/cn";
import { formatCurrency, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { EmergencyFund } from "@/types/planning";
import { useSaveEmergencyFund } from "../api";

const ok = (v: string) => v !== "" && v !== "invalid";
const PRESETS = [3, 6, 9, 12];

export function EmergencyConfigDrawer({ open, onOpenChange, fund }: { open: boolean; onOpenChange: (v: boolean) => void; fund: EmergencyFund | null }) {
  const save = useSaveEmergencyFund();
  const [monthlyCost, setMonthlyCost] = useState(fund?.monthlyCost ?? fund?.suggestions.averageMonthlyExpense ?? "");
  const [months, setMonths] = useState(fund?.targetMonths ?? 6);
  const [custom, setCustom] = useState(fund?.customTarget ?? false);
  const [target, setTarget] = useState(fund?.customTarget ? fund.targetAmount : "");
  const [mode, setMode] = useState<"LINKED" | "MANUAL">(fund?.mode ?? "MANUAL");
  const [accountId, setAccountId] = useState<string | null>(fund?.linkedAccount?.id ?? null);
  const [current, setCurrent] = useState(fund && fund.mode === "MANUAL" ? fund.currentAmount : "");
  const [plan, setPlan] = useState(fund?.monthlyContribution ?? "");
  const [error, setError] = useState<string | null>(null);

  const suggestedCost = fund?.suggestions.averageMonthlyExpense;
  const suggestedPlan = fund?.suggestions.averageMonthlySurplus;
  const autoTarget = ok(monthlyCost) ? (Math.round(toNumber(monthlyCost) * 100) * months) / 100 : 0;

  const submit = async () => {
    setError(null);
    if (!ok(monthlyCost) || toNumber(monthlyCost) <= 0) return setError("Informe seu custo mensal médio.");
    if (custom && (!ok(target) || toNumber(target) <= 0)) return setError("Informe o valor objetivo.");
    if (mode === "LINKED" && !accountId) return setError("Escolha a conta onde a reserva fica guardada.");
    try {
      await save.mutateAsync({
        monthlyCost,
        targetMonths: months,
        targetAmount: custom ? target : null,
        linkedAccountId: mode === "LINKED" ? accountId : null,
        ...(mode === "MANUAL" && { currentAmount: ok(current) ? current : "0" }),
        monthlyContribution: ok(plan) && toNumber(plan) > 0 ? plan : null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={fund ? "Ajustar reserva" : "Configurar reserva"}
        description="Quanto custa seu mês, quantos meses proteger e onde o dinheiro fica."
        footer={
          <>
            <DialogClose asChild><Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button></DialogClose>
            <Button loading={save.isPending} onClick={() => void submit()} className="flex-1 sm:flex-none">Salvar reserva</Button>
          </>
        }
      >
        <div className="space-y-6">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Custo mensal médio" hint={suggestedCost ? undefined : "Some moradia, alimentação, transporte, saúde e contas fixas."}>
            <MoneyInput value={monthlyCost} onChange={setMonthlyCost} />
          </Field>
          {suggestedCost && suggestedCost !== monthlyCost && (
            <button type="button" onClick={() => setMonthlyCost(suggestedCost)} className="-mt-4 text-xs font-medium text-accent hover:underline">
              Usar a média dos seus gastos: {formatCurrency(suggestedCost)}
            </button>
          )}

          <div className="space-y-2">
            <Label>Meses de proteção</Label>
            <div role="radiogroup" aria-label="Meses de proteção" className="grid grid-cols-4 gap-2">
              {PRESETS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}
                  className={cn("h-12 rounded-md text-sm font-medium ring-1 ring-inset", months === m ? "bg-accent-soft text-ink ring-2 ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong")}>
                  {m} meses
                </button>
              ))}
            </div>
            <Input type="number" inputMode="numeric" min={1} max={24} aria-label="Outro número de meses" value={months} onChange={(e) => setMonths(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} className="w-28" />
          </div>

          <div className="space-y-3 rounded-lg bg-surface-sunken p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Valor objetivo</p>
                <p className="num text-xs text-ink-3">{custom ? "Definido por você" : `${months} × custo mensal = ${formatCurrency(autoTarget)}`}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-2">
                Personalizar
                <Switch checked={custom} onCheckedChange={setCustom} aria-label="Personalizar valor objetivo" />
              </label>
            </div>
            {custom && <MoneyInput aria-label="Valor objetivo" value={target} onChange={setTarget} />}
          </div>

          <div className="space-y-3">
            <Label>Onde a reserva está</Label>
            <SegmentedControl<"LINKED" | "MANUAL"> label="Origem do saldo da reserva" value={mode} onChange={setMode}
              options={[{ value: "LINKED", label: "Em uma conta" }, { value: "MANUAL", label: "Informar valor" }]} />
            {mode === "LINKED" ? (
              <Field label="Conta da reserva" hint="O saldo da reserva acompanha o saldo desta conta automaticamente.">
                <AccountSelect value={accountId} onChange={setAccountId} />
              </Field>
            ) : (
              <Field label="Quanto já está guardado" hint="Você atualiza este valor quando guardar ou retirar.">
                <MoneyInput value={current} onChange={setCurrent} />
              </Field>
            )}
          </div>

          <Field label="Quanto pretende guardar por mês" optional hint={suggestedPlan && toNumber(suggestedPlan) > 0 ? `Nos últimos meses sobraram, em média, ${formatCurrency(suggestedPlan)}/mês.` : "Usado para estimar quando você chega ao objetivo."}>
            <MoneyInput value={plan} onChange={setPlan} />
          </Field>
        </div>
      </DrawerContent>
    </Dialog>
  );
}

export function AdjustDialogBody({ onDone }: { onDone: (amount: string, note: string) => Promise<void> }) {
  const [kind, setKind] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = ok(amount) && toNumber(amount) > 0;
  return (
    <div className="space-y-4">
      <SegmentedControl<"IN" | "OUT"> label="Tipo" value={kind} onChange={setKind} options={[{ value: "IN", label: "Guardar" }, { value: "OUT", label: "Retirar" }]} />
      <Field label="Valor"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
      <Field label="Observação" optional><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        className="w-full"
        disabled={!valid}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onDone(kind === "OUT" ? `-${amount}` : amount, note);
          } catch (err) {
            setError(userMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {kind === "IN" ? "Guardar na reserva" : "Retirar da reserva"}
      </Button>
    </div>
  );
}
