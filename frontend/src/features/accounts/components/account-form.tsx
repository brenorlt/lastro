"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Amount } from "@/components/finance/amount";
import { AccountIcon } from "@/components/finance/bank-logo";
import { InstitutionInput } from "@/components/finance/institution-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DrawerContent } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ColorPicker, IconPicker, OptionCards } from "@/components/ui/pickers";
import { Switch } from "@/components/ui/switch";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { ApiError } from "@/services/api-error";
import type { Account, AccountType } from "@/types/finance";
import { ACCOUNT_TYPES, accountTypeLabel, useSaveAccount } from "../api";
import { accountSchema, type AccountFormValues } from "../schemas";

const DEFAULTS: AccountFormValues = {
  name: "",
  institution: "",
  type: "CHECKING",
  initialBalance: "",
  color: "#3F51D8",
  icon: "landmark",
  includeInNetWorth: true,
};

function toValues(a?: Account | null): AccountFormValues {
  if (!a) return DEFAULTS;
  return {
    name: a.name,
    institution: a.institution ?? "",
    type: a.type,
    initialBalance: a.initialBalance,
    color: a.color.toUpperCase(),
    icon: a.icon,
    includeInNetWorth: a.includeInNetWorth,
  };
}

interface AccountFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = criar nova conta. */
  account?: Account | null;
}

export function AccountFormDrawer({ open, onOpenChange, account }: AccountFormDrawerProps) {
  const save = useSaveAccount();
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<AccountFormValues>({ resolver: zodResolver(accountSchema), values: toValues(account) });
  const { formError, setFormError, handle } = useApiFormErrors(setError, ["name", "institution", "initialBalance"] as const);
  const preview = useWatch({ control });

  const onSubmit = async (v: AccountFormValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: account?.id, input: { ...v, institution: v.institution || null } });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ACCOUNT_NAME_TAKEN") {
        setError("name", { message: "Você já tem uma conta com esse nome" });
      } else handle(err);
    }
  };

  /** Ao escolher o tipo, sugere o ícone do tipo se o ícone ainda não foi tocado. */
  const onTypeChange = (t: AccountType, change: (v: AccountType) => void) => {
    change(t);
    if (!account && !getFieldState("icon").isDirty) {
      setValue("icon", ACCOUNT_TYPES.find((x) => x.value === t)?.icon ?? "wallet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={account ? "Editar conta" : "Nova conta"}
        description={account ? undefined : "Onde seu dinheiro está guardado: banco, carteira ou corretora."}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" className="flex-1 sm:flex-none">Cancelar</Button>
            </DialogClose>
            <Button type="submit" form="account-form" loading={save.isPending} className="flex-1 sm:flex-none">
              {account ? "Salvar alterações" : "Criar conta"}
            </Button>
          </>
        }
      >
        <form id="account-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-surface-sunken p-4" aria-hidden>
            <AccountIcon account={{ institution: preview.institution, icon: preview.icon ?? "wallet", color: preview.color ?? "#3F51D8" }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{preview.name || "Nome da conta"}</p>
              <p className="truncate text-xs text-ink-3">{[preview.institution, accountTypeLabel(preview.type ?? "CHECKING")].filter(Boolean).join(" · ")}</p>
            </div>
            <Amount value={preview.initialBalance && preview.initialBalance !== "invalid" ? preview.initialBalance : 0} className="text-sm font-semibold" />
          </div>

          {formError && <FormAlert>{formError.message}</FormAlert>}

          <Field label="Nome" error={errors.name?.message}>
            <Input placeholder="Ex.: Conta principal" autoFocus {...register("name")} />
          </Field>
          <Controller
            control={control}
            name="institution"
            render={({ field }) => (
              <Field label="Banco ou instituição" optional error={errors.institution?.message}>
                <InstitutionInput placeholder="Ex.: Itaú, Nubank, XP" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
              </Field>
            )}
          />

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <OptionCards label="Tipo de conta" value={field.value} onChange={(t) => onTypeChange(t, field.onChange)} options={ACCOUNT_TYPES} />
              )}
            />
          </div>

          <Controller
            control={control}
            name="initialBalance"
            render={({ field }) => (
              <Field
                label={account ? "Saldo inicial" : "Saldo atual"}
                hint={account ? "Alterar o saldo inicial ajusta o saldo atual pela mesma diferença." : "Quanto há na conta hoje. Pode ser negativo (cheque especial)."}
                error={errors.initialBalance?.message}
              >
                <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} allowNegative />
              </Field>
            )}
          />

          <div className="space-y-2">
            <Label>Cor</Label>
            <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} label="Cor da conta" />} />
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={preview.color ?? "#3F51D8"} label="Ícone da conta" />}
            />
          </div>

          <Controller
            control={control}
            name="includeInNetWorth"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-md bg-surface-sunken px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-ink">Incluir no patrimônio</span>
                  <span className="block text-xs text-ink-3">Desative para contas de terceiros ou que você só acompanha.</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Incluir no patrimônio" />
              </label>
            )}
          />
        </form>
      </DrawerContent>
    </Dialog>
  );
}
