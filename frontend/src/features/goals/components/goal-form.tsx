"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DrawerContent } from "@/components/ui/dialog";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Field, Label } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ColorPicker, IconPicker, SegmentedControl } from "@/components/ui/pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moneyString } from "@/features/accounts/schemas";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { todayISO } from "@/lib/dates";
import { formatCurrency, toNumber } from "@/lib/format";
import type { Goal, GoalCategory, Priority } from "@/types/planning";
import { GOAL_CATEGORIES, useSaveGoal } from "../api";
import { monthsUntil, requiredMonthly, monthYear } from "../model";

const optionalMoney = z.string().refine((v) => v === "" || (v !== "invalid" && /^\d{1,15}(\.\d{1,2})?$/.test(v)), "Valor inválido");

const schema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à meta").max(60),
    category: z.enum(["EMERGENCY", "REAL_ESTATE", "VEHICLE", "TRAVEL", "RETIREMENT", "FINANCIAL_INDEPENDENCE", "EQUIPMENT", "EDUCATION", "OTHER"]),
    targetAmount: moneyString({ required: "Quanto você precisa?" }).refine((v) => v === "invalid" || Number(v) > 0, "Deve ser maior que zero"),
    currentAmount: optionalMoney,
    targetDate: z.string(),
    monthlyContribution: optionalMoney,
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    icon: z.string().min(1),
  })
  .refine((v) => !v.targetDate || v.targetDate > todayISO(), { path: ["targetDate"], message: "Escolha uma data futura" });

type Values = z.infer<typeof schema>;

function defaults(goal?: Goal | null): Values {
  if (goal) {
    return {
      name: goal.name,
      category: goal.category,
      targetAmount: goal.targetAmount,
      currentAmount: "",
      targetDate: goal.targetDate ?? "",
      monthlyContribution: goal.monthlyContribution ?? "",
      priority: goal.priority,
      color: goal.color.toUpperCase(),
      icon: goal.icon,
    };
  }
  const c = GOAL_CATEGORIES[0]!;
  return { name: "", category: c.value, targetAmount: "", currentAmount: "", targetDate: "", monthlyContribution: "", priority: "MEDIUM", color: c.color, icon: c.icon };
}

export function GoalFormDrawer({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (v: boolean) => void; goal?: Goal | null }) {
  const save = useSaveGoal();
  const { control, register, handleSubmit, setValue, setError, getFieldState, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    values: defaults(goal),
  });
  const { formError, handle } = useApiFormErrors(setError, ["name", "targetAmount", "currentAmount", "targetDate", "monthlyContribution"] as const);
  const v = useWatch({ control });

  const target = v.targetAmount && v.targetAmount !== "invalid" ? toNumber(v.targetAmount) : 0;
  const current = goal ? toNumber(goal.currentAmount) : v.currentAmount && v.currentAmount !== "invalid" ? toNumber(v.currentAmount) : 0;
  const months = v.targetDate && v.targetDate > todayISO() ? monthsUntil(v.targetDate) : 0;
  const needed = target > 0 && months > 0 ? requiredMonthly(target, current, months) : null;

  const onCategory = (c: GoalCategory, change: (c: GoalCategory) => void) => {
    change(c);
    const meta = GOAL_CATEGORIES.find((x) => x.value === c)!;
    if (!getFieldState("icon").isDirty) setValue("icon", meta.icon);
    if (!getFieldState("color").isDirty) setValue("color", meta.color);
  };

  const onSubmit = async (x: Values) => {
    try {
      await save.mutateAsync({
        id: goal?.id,
        input: {
          name: x.name,
          category: x.category,
          targetAmount: x.targetAmount,
          ...(!goal && x.currentAmount ? { currentAmount: x.currentAmount } : {}),
          targetDate: x.targetDate || null,
          monthlyContribution: x.monthlyContribution || null,
          priority: x.priority,
          color: x.color,
          icon: x.icon,
        },
      });
      onOpenChange(false);
    } catch (err) {
      handle(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={goal ? "Editar meta" : "Nova meta"}
        description={goal ? undefined : "Um objetivo com valor e prazo vira um plano mensal."}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button></DialogClose>
            <Button type="submit" form="goal-form" loading={save.isPending} className="flex-1 sm:flex-none">{goal ? "Salvar alterações" : "Criar meta"}</Button>
          </>
        }
      >
        <form id="goal-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {formError && <FormAlert>{formError.message}</FormAlert>}
          <div className="flex items-end gap-3">
            <EntityIcon icon={v.icon ?? "target"} color={v.color ?? "#3F51D8"} size="lg" />
            <Field label="Nome" error={errors.name?.message} className="flex-1">
              <Input autoFocus placeholder="Ex.: Viagem ao Japão" {...register("name")} />
            </Field>
          </div>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Field label="Tipo de objetivo">
                <Select value={field.value} onValueChange={(c) => onCategory(c as GoalCategory, field.onChange)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GOAL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller control={control} name="targetAmount" render={({ field }) => (
              <Field label="Valor objetivo" error={errors.targetAmount?.message}><MoneyInput value={field.value} onChange={field.onChange} /></Field>
            )} />
            {!goal && (
              <Controller control={control} name="currentAmount" render={({ field }) => (
                <Field label="Já tenho" optional error={errors.currentAmount?.message}><MoneyInput value={field.value} onChange={field.onChange} /></Field>
              )} />
            )}
            <Field label="Prazo" optional error={errors.targetDate?.message}>
              <Input type="date" min={todayISO()} {...register("targetDate")} />
            </Field>
            <Controller control={control} name="monthlyContribution" render={({ field }) => (
              <Field label="Quanto pretendo guardar por mês" optional error={errors.monthlyContribution?.message}><MoneyInput value={field.value} onChange={field.onChange} /></Field>
            )} />
          </div>
          {needed !== null && (
            <p className="rounded-lg bg-surface-sunken px-4 py-3 text-sm text-ink-2">
              Para chegar a {formatCurrency(target)} até {monthYear(v.targetDate!)}, guarde <strong className="num font-semibold text-ink">{formatCurrency(needed)}/mês</strong> por {months} {months === 1 ? "mês" : "meses"}.
            </p>
          )}
          <Controller control={control} name="priority" render={({ field }) => (
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <SegmentedControl<Priority> label="Prioridade" value={field.value} onChange={field.onChange} options={[{ value: "LOW", label: "Baixa" }, { value: "MEDIUM", label: "Média" }, { value: "HIGH", label: "Alta" }]} />
            </div>
          )} />
          <div className="space-y-2">
            <Label>Cor</Label>
            <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} label="Cor da meta" />} />
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <Controller control={control} name="icon" render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={v.color ?? "#3F51D8"} label="Ícone da meta" />} />
          </div>
        </form>
      </DrawerContent>
    </Dialog>
  );
}
