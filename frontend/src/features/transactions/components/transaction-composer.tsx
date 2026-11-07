"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DrawerContent } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagsInput } from "@/components/ui/tags-input";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { formatCurrency } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { ApiError } from "@/services/api-error";
import { useComposer, type ComposerMode } from "@/stores/composer-store";
import type { SeriesScope } from "@/types/finance";
import { useCategorySuggestion } from "../../categories/api";
import { isSeries, useCreateTransaction, useCreateTransfer, useTags, useUpdateTransaction } from "../api";
import { composerSchema, emptyComposer, fromTransaction, toTransactionInput, toTransactionPatch, toTransferInput, type ComposerValues } from "../schemas";
import { AccountSelect, CategorySelect, PaymentSourceSelect } from "./entity-selects";
import { ScopeDialog } from "./scope-dialog";

const FIELDS = ["amount", "description", "date", "accountId", "toAccountId", "categoryId", "notes"] as const;

/** Campos da API que aparecem com outro nome no formulário. */
const FIELD_ALIASES: Record<string, (typeof FIELDS)[number]> = { fromAccountId: "accountId", status: "date", transferAccountId: "toAccountId" };

const FREQUENCIES = [
  { value: "MONTHLY", label: "Todo mês" },
  { value: "WEEKLY", label: "Toda semana" },
  { value: "YEARLY", label: "Todo ano" },
  { value: "DAILY", label: "Todo dia" },
] as const;

/** Montado uma vez no AppShell; controlado pelo store global do compositor. */
export function TransactionComposer() {
  const { open, close } = useComposer();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      {open && <ComposerBody />}
    </Dialog>
  );
}

function ComposerBody() {
  const { mode: initialMode, editing, accountId, creditCardId, close } = useComposer();
  const today = todayISO();
  const create = useCreateTransaction();
  const transfer = useCreateTransfer();
  const update = useUpdateTransaction();
  const tags = useTags();
  const [pendingScope, setPendingScope] = useState<ComposerValues | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: editing ? fromTransaction(editing) : { ...emptyComposer(initialMode, today, accountId), creditCardId },
  });
  const { formError, setFormError, handle } = useApiFormErrors(setError, FIELDS);
  const v = useWatch({ control });
  const mode = (v.mode ?? initialMode) as ComposerMode;
  const future = (v.date ?? today) > today;
  const onCard = mode === "EXPENSE" && Boolean(v.creditCardId);
  const categoryType = mode === "INCOME" ? "INCOME" : "EXPENSE";
  // Lançamento novo sem categoria: mostra qual o sistema vai aplicar ao salvar.
  const suggestion = useCategorySuggestion(v.description ?? "", categoryType, !editing && mode !== "TRANSFER" && !v.categoryId);
  const autoLabel = (
    <span className="inline-flex items-center gap-1.5">
      <Sparkles className="size-3.5 shrink-0 text-accent" aria-hidden />
      {suggestion?.name ?? "Automática"}
    </span>
  );
  const autoHint = editing
    ? editing.categoryAuto && v.categoryId === editing.category?.id
      ? "Escolhida automaticamente. Salvar confirma a categoria."
      : undefined
    : suggestion && !v.categoryId
      ? "Sugerida pela descrição. Escolha outra se preferir."
      : undefined;

  const onError = (err: unknown) => {
    if (err instanceof ApiError) {
      for (const f of err.fields) f.field = FIELD_ALIASES[f.field] ?? f.field;
      const map: Record<string, keyof ComposerValues> = {
        ACCOUNT_ARCHIVED: "accountId",
        CARD_UNAVAILABLE: "accountId",
        SAME_ACCOUNT_TRANSFER: "toAccountId",
        CATEGORY_TYPE_MISMATCH: "categoryId",
      };
      const field = map[err.code];
      if (field) return setError(field, { message: err.message });
    }
    handle(err);
  };

  const submitEdit = async (values: ComposerValues, scope: SeriesScope) => {
    if (!editing) return;
    const input = toTransactionPatch(values, editing);
    await update.mutateAsync({ id: editing.id, input, scope });
    close();
  };

  const onSubmit = async (values: ComposerValues) => {
    setFormError(null);
    try {
      if (editing) {
        if (isSeries(editing)) return setPendingScope(values);
        return await submitEdit(values, "single");
      }
      if (values.mode === "TRANSFER") await transfer.mutateAsync(toTransferInput(values));
      else await create.mutateAsync(toTransactionInput(values));
      close();
    } catch (err) {
      onError(err);
    }
  };

  const perInstallment = v.repeat === "INSTALLMENTS" && v.amount && v.amount !== "invalid" && v.installments
    ? formatCurrency(Number(v.amount) / v.installments)
    : null;

  const title = editing ? "Editar lançamento" : mode === "INCOME" ? "Nova receita" : mode === "TRANSFER" ? "Nova transferência" : "Nova despesa";
  const paidLabel = mode === "INCOME" ? "Já recebi" : mode === "TRANSFER" ? "Já transferi" : "Já paguei";

  return (
    <>
      <DrawerContent
        title={title}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button></DialogClose>
            <Button type="submit" form="composer" loading={isSubmitting} className="flex-1 sm:flex-none">
              {editing ? "Salvar alterações" : "Salvar lançamento"}
            </Button>
          </>
        }
      >
        <form id="composer" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {!editing && (
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <SegmentedControl<ComposerMode>
                  label="Tipo de lançamento"
                  value={field.value}
                  onChange={(m) => {
                    field.onChange(m);
                    setValue("categoryId", null);
                    if (m === "TRANSFER") setValue("repeat", "NONE");
                  }}
                  options={[
                    { value: "EXPENSE", label: "Despesa" },
                    { value: "INCOME", label: "Receita" },
                    { value: "TRANSFER", label: "Transferência" },
                  ]}
                />
              )}
            />
          )}

          {formError && <FormAlert>{formError.message}</FormAlert>}

          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Field label={v.repeat === "INSTALLMENTS" ? "Valor total" : "Valor"} error={errors.amount?.message} hint={perInstallment ? `${v.installments}× de aproximadamente ${perInstallment}` : undefined}>
                <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} autoFocus className="h-12 text-lg font-semibold" />
              </Field>
            )}
          />

          <Field label="Descrição" optional={mode === "TRANSFER"} error={errors.description?.message}>
            <Input placeholder={mode === "INCOME" ? "Ex.: Salário" : mode === "TRANSFER" ? "Ex.: Reserva do mês" : "Ex.: Mercado"} {...register("description")} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            {mode === "EXPENSE" ? (
              <Field label="Pagar com" error={errors.accountId?.message}>
                <PaymentSourceSelect
                  accountId={v.accountId ?? null}
                  creditCardId={v.creditCardId ?? null}
                  onChange={(src) => {
                    setValue("accountId", src.accountId, { shouldValidate: Boolean(errors.accountId) });
                    setValue("creditCardId", src.creditCardId);
                  }}
                />
              </Field>
            ) : (
              <Controller
                control={control}
                name="accountId"
                render={({ field }) => (
                  <Field label={mode === "TRANSFER" ? "De" : "Receber em"} error={errors.accountId?.message}>
                    <AccountSelect value={field.value} onChange={field.onChange} />
                  </Field>
                )}
              />
            )}
            {mode === "TRANSFER" ? (
              <Controller
                control={control}
                name="toAccountId"
                render={({ field }) => (
                  <Field label="Para" error={errors.toAccountId?.message}>
                    <AccountSelect value={field.value} onChange={field.onChange} exclude={v.accountId} placeholder="Conta de destino" />
                  </Field>
                )}
              />
            ) : (
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Field label="Categoria" hint={autoHint} error={errors.categoryId?.message}>
                    <CategorySelect type={categoryType} value={field.value} onChange={field.onChange} allLabel={editing ? undefined : autoLabel} />
                  </Field>
                )}
              />
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
            <Field label="Data" error={errors.date?.message}>
              <Input
                type="date"
                {...register("date", {
                  // Ao cruzar hoje, o switch volta ao padrão da data (futuro = agendado); o usuário ainda pode marcar como pago.
                  onChange: (e) => {
                    const next = String(e.target.value) > today;
                    if (next !== future) setValue("paid", !next);
                  },
                })}
              />
            </Field>
            {onCard ? (
              <p className="flex h-10 items-center rounded-md bg-surface-sunken px-3 text-xs text-ink-2">Entra na fatura conforme a data da compra.</p>
            ) : (
            <Controller
              control={control}
              name="paid"
              render={({ field }) => (
                <label className="flex h-10 items-center justify-between gap-3 rounded-md bg-surface-sunken px-3">
                  <span className="text-sm text-ink">{paidLabel}</span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={paidLabel} />
                </label>
              )}
            />
            )}
          </div>
          {future && !onCard && (
            <p className="-mt-3 text-xs text-ink-3">
              {v.paid ? "Pago adiantado: já entra no saldo." : "Fica agendado e não altera o saldo até ser confirmado."}
            </p>
          )}

          {!editing && mode !== "TRANSFER" && (
            <div className="space-y-3 rounded-lg ring-1 ring-line p-4">
              <Controller
                control={control}
                name="repeat"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Repetição</Label>
                    <SegmentedControl
                      label="Repetição"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "NONE", label: "Única" },
                        { value: "INSTALLMENTS", label: "Parcelada" },
                        { value: "RECURRING", label: "Recorrente" },
                      ]}
                    />
                  </div>
                )}
              />
              {v.repeat === "INSTALLMENTS" && (
                <Field label="Número de parcelas" error={errors.installments?.message} hint="Uma parcela por mês, a partir da data escolhida.">
                  <Input type="number" inputMode="numeric" min={2} max={60} {...register("installments", { valueAsNumber: true })} />
                </Field>
              )}
              {v.repeat === "RECURRING" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    control={control}
                    name="frequency"
                    render={({ field }) => (
                      <Field label="Frequência">
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                  <Field label="Termina em" optional error={errors.endDate?.message} hint="Em branco: sem data de término.">
                    <Input type="date" {...register("endDate")} />
                  </Field>
                  <Controller
                    control={control}
                    name="autoConfirm"
                    render={({ field }) => (
                      <label className="flex items-center justify-between gap-3 sm:col-span-2">
                        <span>
                          <span className="block text-sm text-ink">Confirmar automaticamente</span>
                          <span className="block text-xs text-ink-3">Na data, marca como {mode === "INCOME" ? "recebido" : "pago"} sem você precisar confirmar.</span>
                        </span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Confirmar automaticamente" />
                      </label>
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {mode !== "TRANSFER" && (
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <Field label="Tags" optional hint="Enter ou vírgula para adicionar.">
                  <TagsInput value={field.value} onChange={field.onChange} suggestions={(tags.data ?? []).map((t) => t.name)} />
                </Field>
              )}
            />
          )}

          <Field label="Observação" optional error={errors.notes?.message}>
            <Textarea rows={2} placeholder="Visível só para você" {...register("notes")} />
          </Field>
        </form>
      </DrawerContent>

      <ScopeDialog
        transaction={pendingScope ? editing : null}
        action="edit"
        loading={update.isPending}
        onCancel={() => setPendingScope(null)}
        onConfirm={async (scope) => {
          try {
            await submitEdit(pendingScope!, scope);
          } catch (err) {
            onError(err);
          } finally {
            setPendingScope(null);
          }
        }}
      />
    </>
  );
}
