"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountSelect } from "@/features/transactions/components/entity-selects";
import { todayISO } from "@/lib/dates";
import { formatCurrency, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { Asset, AssetType, Liability, LiabilityType } from "@/types/wealth";
import { ASSET_TYPES, LIABILITY_TYPES, usePayLiability, useSaveAsset, useSaveLiability } from "../api";

const ok = (v: string) => v !== "" && v !== "invalid";

function Footer({ label, loading, onSubmit }: { label: string; loading: boolean; onSubmit: () => void }) {
  return (
    <>
      <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
      <Button loading={loading} onClick={onSubmit}>{label}</Button>
    </>
  );
}

export function AssetDialog({ asset, onOpenChange }: { asset: Asset | null | undefined; onOpenChange: (v: boolean) => void }) {
  const save = useSaveAsset();
  const [name, setName] = useState(asset?.name ?? "");
  const [type, setType] = useState<AssetType>(asset?.type ?? "REAL_ESTATE");
  const [value, setValue] = useState(asset?.value ?? "");
  const [acquiredAt, setAcquiredAt] = useState(asset?.acquiredAt ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Dê um nome ao bem.");
    if (!ok(value)) return setError("Informe o valor estimado.");
    try {
      await save.mutateAsync({ id: asset?.id, input: { name: name.trim(), type, value, acquiredAt: acquiredAt || null } });
      onOpenChange(false);
    } catch (err) { setError(userMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={asset ? "Editar bem" : "Adicionar bem"} description="Imóveis, veículos e outros bens entram no seu patrimônio pelo valor que você estimar." footer={<Footer label={asset ? "Salvar" : "Adicionar"} loading={save.isPending} onSubmit={() => void submit()} />}>
        <div className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Nome"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Apartamento Pinheiros" /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Valor estimado hoje" hint="Use o valor de mercado, não o de compra."><MoneyInput value={value} onChange={setValue} /></Field>
            <Field label="Adquirido em" optional><Input type="date" max={todayISO()} value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} /></Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LiabilityDialog({ liability, onOpenChange }: { liability: Liability | null | undefined; onOpenChange: (v: boolean) => void }) {
  const save = useSaveLiability();
  const [name, setName] = useState(liability?.name ?? "");
  const [type, setType] = useState<LiabilityType>(liability?.type ?? "FINANCING");
  const [principal, setPrincipal] = useState(liability?.principal ?? "");
  const [outstanding, setOutstanding] = useState(liability?.outstandingBalance ?? "");
  const [rate, setRate] = useState(liability?.interestRate != null ? String(liability.interestRate) : "");
  const [monthly, setMonthly] = useState(liability?.monthlyPayment ?? "");
  const [dueDay, setDueDay] = useState(liability?.dueDay ? String(liability.dueDay) : "");
  const [endDate, setEndDate] = useState(liability?.endDate ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Dê um nome à dívida.");
    if (!ok(outstanding)) return setError("Informe quanto ainda falta pagar.");
    try {
      await save.mutateAsync({
        id: liability?.id,
        input: {
          name: name.trim(),
          type,
          principal: ok(principal) ? principal : outstanding,
          outstandingBalance: outstanding,
          interestRate: rate ? rate.replace(",", ".") : null,
          monthlyPayment: ok(monthly) ? monthly : null,
          dueDay: dueDay ? Number(dueDay) : null,
          endDate: endDate || null,
        },
      });
      onOpenChange(false);
    } catch (err) { setError(userMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={liability ? "Editar dívida" : "Adicionar dívida"} description="Financiamentos e empréstimos reduzem seu patrimônio líquido. Cartões entram automaticamente." footer={<Footer label={liability ? "Salvar" : "Adicionar"} loading={save.isPending} onSubmit={() => void submit()} />}>
        <div className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
            <Field label="Tipo">
              <Select value={type} onValueChange={(v) => setType(v as LiabilityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LIABILITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Nome"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Financiamento do carro" /></Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Saldo devedor atual"><MoneyInput value={outstanding} onChange={setOutstanding} /></Field>
            <Field label="Valor contratado" optional><MoneyInput value={principal} onChange={setPrincipal} /></Field>
            <Field label="Parcela mensal" optional><MoneyInput value={monthly} onChange={setMonthly} /></Field>
            <Field label="Juros ao ano (%)" optional><Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ""))} className="num" placeholder="Ex.: 12,5" /></Field>
            <Field label="Dia de vencimento" optional><Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
            <Field label="Termina em" optional><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PayLiabilityDialog({ liability, onOpenChange }: { liability: Liability; onOpenChange: (v: boolean) => void }) {
  const pay = usePayLiability();
  const [amount, setAmount] = useState(liability.monthlyPayment ?? "");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!ok(amount) || toNumber(amount) <= 0) return setError("Informe o valor pago.");
    try {
      await pay.mutateAsync({ id: liability.id, input: { amount, date, accountId } });
      onOpenChange(false);
    } catch (err) { setError(userMessage(err)); }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={`Pagamento: ${liability.name}`} description={`Saldo devedor: ${formatCurrency(liability.outstandingBalance)}`} footer={<Footer label="Registrar pagamento" loading={pay.isPending} onSubmit={() => void submit()} />}>
        <div className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Valor pago"><MoneyInput autoFocus value={amount} onChange={setAmount} /></Field>
            <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <Field label="Pago com" optional hint="Opcional: debita a conta escolhida."><AccountSelect value={accountId} onChange={setAccountId} allLabel="Não movimentar conta" /></Field>
          <p className="text-xs text-ink-3">O valor abate o saldo devedor. A divisão entre juros e amortização não é calculada.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
