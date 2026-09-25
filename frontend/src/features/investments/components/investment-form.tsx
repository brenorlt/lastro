"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DrawerContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AccountSelect } from "@/features/transactions/components/entity-selects";
import { todayISO } from "@/lib/dates";
import { userMessage } from "@/services/api-error";
import type { Investment, InvestmentType, Liquidity } from "@/types/wealth";
import { INVESTMENT_TYPES, LIQUIDITY, useSaveInvestment } from "../api";

const ok = (v: string) => v !== "" && v !== "invalid";
const GROUPS = ["Renda fixa", "Renda variável", "Outros"] as const;
const QUANTITY_TYPES: InvestmentType[] = ["STOCKS", "ETFS", "REITS", "CRYPTO"];

export function InvestmentFormDrawer({ open, onOpenChange, investment }: { open: boolean; onOpenChange: (v: boolean) => void; investment?: Investment | null }) {
  const save = useSaveInvestment();
  const editing = Boolean(investment);
  const [name, setName] = useState(investment?.name ?? "");
  const [ticker, setTicker] = useState(investment?.ticker ?? "");
  const [institution, setInstitution] = useState(investment?.institution ?? "");
  const [type, setType] = useState<InvestmentType>(investment?.type ?? "CDB");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [invested, setInvested] = useState("");
  const [current, setCurrent] = useState("");
  const [appliedAt, setAppliedAt] = useState(investment?.appliedAt ?? todayISO());
  const [maturity, setMaturity] = useState(investment?.maturityDate ?? "");
  const [liquidity, setLiquidity] = useState<Liquidity>(investment?.liquidity ?? "DAILY");
  const [liquidityDays, setLiquidityDays] = useState(investment?.liquidityDays ? String(investment.liquidityDays) : "");
  const [notes, setNotes] = useState(investment?.notes ?? "");
  const [fromAccount, setFromAccount] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byQuantity = QUANTITY_TYPES.includes(type);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Dê um nome ao investimento.");
    if (!editing) {
      if (byQuantity && !(quantity && Number(quantity) > 0 && ok(price))) return setError("Informe quantidade e preço médio.");
      if (!byQuantity && !ok(invested)) return setError("Informe o valor aplicado.");
      if (fromAccount && !accountId) return setError("Escolha a conta de onde saiu o dinheiro.");
    }
    try {
      await save.mutateAsync({
        id: investment?.id,
        input: {
          name: name.trim(),
          ticker: ticker.trim().toUpperCase() || null,
          institution: institution.trim() || null,
          type,
          appliedAt,
          maturityDate: maturity || null,
          liquidity,
          liquidityDays: liquidity === "D_PLUS_X" && liquidityDays ? Number(liquidityDays) : null,
          notes: notes.trim() || null,
          ...(!editing && {
            ...(byQuantity ? { quantity: quantity.replace(",", "."), averagePrice: price } : { investedAmount: invested }),
            currentValue: ok(current) ? current : null,
            fundingAccountId: fromAccount ? accountId : null,
          }),
        },
      });
      onOpenChange(false);
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={editing ? "Editar investimento" : "Novo investimento"}
        description={editing ? "Valores mudam por movimentações (aporte, resgate, atualização)." : "Cadastre algo que você já tem ou uma aplicação nova."}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button></DialogClose>
            <Button loading={save.isPending} onClick={() => void submit()} className="flex-1 sm:flex-none">{editing ? "Salvar alterações" : "Cadastrar"}</Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Tipo">
            <Select value={type} onValueChange={(v) => setType(v as InvestmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectGroup key={g}>
                    <p className="px-2.5 pb-1 pt-2 text-2xs font-medium text-ink-3">{g}</p>
                    {INVESTMENT_TYPES.filter((t) => t.group === g).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <Field label="Nome"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={byQuantity ? "Ex.: Itaú Unibanco" : "Ex.: CDB Banco Inter 110% CDI"} /></Field>
            <Field label="Código" optional><Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder={byQuantity ? "ITUB4" : ""} className="uppercase" maxLength={12} /></Field>
          </div>
          <Field label="Instituição" optional><Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Corretora ou banco" /></Field>

          {!editing && (
            <>
              {byQuantity ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Quantidade"><Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ""))} className="num" /></Field>
                  <Field label="Preço médio"><MoneyInput value={price} onChange={setPrice} /></Field>
                </div>
              ) : (
                <Field label="Valor aplicado"><MoneyInput value={invested} onChange={setInvested} /></Field>
              )}
              <Field label="Valor atual" optional hint="Em branco: igual ao aplicado. Atualize depois quando quiser."><MoneyInput value={current} onChange={setCurrent} /></Field>
            </>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Data da aplicação"><Input type="date" max={todayISO()} value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} /></Field>
            <Field label="Vencimento" optional><Input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} /></Field>
            <Field label="Liquidez">
              <Select value={liquidity} onValueChange={(v) => setLiquidity(v as Liquidity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LIQUIDITY.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {liquidity === "D_PLUS_X" && <Field label="Dias para resgate"><Input type="number" min={1} value={liquidityDays} onChange={(e) => setLiquidityDays(e.target.value)} /></Field>}
          </div>

          {!editing && (
            <div className="space-y-3 rounded-lg bg-surface-sunken p-4">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-ink">O dinheiro saiu de uma conta agora</span>
                  <span className="block text-xs text-ink-3">Desligado: você está só registrando algo que já tinha.</span>
                </span>
                <Switch checked={fromAccount} onCheckedChange={setFromAccount} aria-label="Debitar de uma conta" />
              </label>
              {fromAccount && <AccountSelect value={accountId} onChange={setAccountId} />}
            </div>
          )}
          <Field label="Observação" optional><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </DrawerContent>
    </Dialog>
  );
}
