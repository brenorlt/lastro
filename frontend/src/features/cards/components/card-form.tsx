"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DrawerContent } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ColorPicker } from "@/components/ui/pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moneyString } from "@/features/accounts/schemas";
import { AccountSelect } from "@/features/transactions/components/entity-selects";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { ApiError } from "@/services/api-error";
import type { CardBrand, CreditCard } from "@/types/cards";
import { BRANDS, useSaveCard } from "../api";
import { CardVisual } from "./card-visual";

const day = z.number({ error: "Informe o dia" }).int().min(1, "Entre 1 e 31").max(31, "Entre 1 e 31");

const schema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao cartão").max(40),
  institution: z.string().trim().max(60),
  brand: z.enum(["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"]),
  limit: moneyString({ required: "Informe o limite" }).refine((v) => v === "invalid" || Number(v) > 0, "Deve ser maior que zero"),
  closingDay: day,
  dueDay: day,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  lastFourDigits: z.string().refine((v) => v === "" || /^\d{4}$/.test(v), "Use os 4 últimos dígitos"),
  paymentAccountId: z.string().nullable(),
});

type Values = z.infer<typeof schema>;

const toValues = (c?: CreditCard | null): Values =>
  c
    ? { name: c.name, institution: c.institution ?? "", brand: c.brand, limit: c.limit, closingDay: c.closingDay, dueDay: c.dueDay, color: c.color.toUpperCase(), lastFourDigits: c.lastFourDigits ?? "", paymentAccountId: c.paymentAccount?.id ?? null }
    : { name: "", institution: "", brand: "MASTERCARD", limit: "", closingDay: 1, dueDay: 10, color: "#111316", lastFourDigits: "", paymentAccountId: null };

export function CardFormDrawer({ open, onOpenChange, card }: { open: boolean; onOpenChange: (v: boolean) => void; card?: CreditCard | null }) {
  const save = useSaveCard();
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), values: toValues(card) });
  const { formError, handle } = useApiFormErrors(setError, ["name", "limit", "closingDay", "dueDay", "lastFourDigits"] as const);
  const v = useWatch({ control });

  const onSubmit = async (x: Values) => {
    try {
      await save.mutateAsync({
        id: card?.id,
        input: { ...x, institution: x.institution || null, lastFourDigits: x.lastFourDigits || null, paymentAccountId: x.paymentAccountId },
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "CARD_NAME_TAKEN") setError("name", { message: "Você já tem um cartão com esse nome" });
      else handle(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={card ? "Editar cartão" : "Novo cartão"}
        description={card ? "Mudanças de fechamento e vencimento valem para as próximas compras." : "Nunca pedimos o número completo do cartão — só o que é preciso para organizar suas faturas."}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button></DialogClose>
            <Button type="submit" form="card-form" loading={save.isPending} className="flex-1 sm:flex-none">{card ? "Salvar alterações" : "Cadastrar cartão"}</Button>
          </>
        }
      >
        <form id="card-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <CardVisual name={v.name || "Nome do cartão"} brand={v.brand ?? "OTHER"} color={v.color ?? "#111316"} lastFour={v.lastFourDigits || null} institution={v.institution || null} className="mx-auto" />
          {formError && <FormAlert>{formError.message}</FormAlert>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome" error={errors.name?.message} className="sm:col-span-2"><Input autoFocus placeholder="Ex.: Nubank Ultravioleta" {...register("name")} /></Field>
            <Field label="Banco" optional><Input placeholder="Ex.: Nubank" {...register("institution")} /></Field>
            <Controller control={control} name="brand" render={({ field }) => (
              <Field label="Bandeira">
                <Select value={field.value} onValueChange={(b) => field.onChange(b as CardBrand)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BRANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )} />
            <Controller control={control} name="limit" render={({ field }) => (
              <Field label="Limite total" error={errors.limit?.message}><MoneyInput value={field.value} onChange={field.onChange} /></Field>
            )} />
            <Field label="Final do cartão" optional error={errors.lastFourDigits?.message}>
              <Input inputMode="numeric" maxLength={4} placeholder="1234" autoComplete="off" {...register("lastFourDigits")} />
            </Field>
            <Field label="Dia de fechamento" error={errors.closingDay?.message} hint="Compras nesse dia já entram na fatura seguinte.">
              <Input type="number" inputMode="numeric" min={1} max={31} {...register("closingDay", { valueAsNumber: true })} />
            </Field>
            <Field label="Dia de vencimento" error={errors.dueDay?.message}>
              <Input type="number" inputMode="numeric" min={1} max={31} {...register("dueDay", { valueAsNumber: true })} />
            </Field>
            <Controller control={control} name="paymentAccountId" render={({ field }) => (
              <Field label="Conta que paga a fatura" optional className="sm:col-span-2" hint="Sugerida ao registrar o pagamento.">
                <AccountSelect value={field.value} onChange={field.onChange} allLabel="Escolher na hora" />
              </Field>
            )} />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} label="Cor do cartão" />} />
          </div>
        </form>
      </DrawerContent>
    </Dialog>
  );
}
