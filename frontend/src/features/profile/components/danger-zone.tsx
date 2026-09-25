"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card } from "@/components/ui/primitives";
import { SettingsSection } from "@/components/ui/settings-section";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { profileApi } from "../api";
import { deleteAccountSchema, type DeleteAccountInput } from "../schemas";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema) });
  const { formError, handle } = useApiFormErrors(setError, ["password"] as const);

  const onSubmit = async ({ password }: DeleteAccountInput) => {
    try {
      await profileApi.deleteAccount(password);
      queryClient.clear();
      router.replace("/?conta=excluida");
    } catch (err) {
      handle(err);
    }
  };

  return (
    <SettingsSection id="excluir" title="Excluir conta" description="Remove definitivamente sua conta e todos os seus dados.">
      <Card className="flex flex-col gap-4 p-5 ring-negative/30 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-sm text-ink-2">
          Contas, lançamentos, metas, investimentos e histórico serão apagados. <strong className="font-medium text-ink">Esta ação não pode ser desfeita.</strong>
        </p>
        <Button variant="danger" onClick={() => setOpen(true)} className="shrink-0">
          Excluir minha conta
        </Button>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent
          title="Excluir sua conta?"
          description="Todos os seus dados financeiros serão apagados permanentemente."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button variant="danger" type="submit" form="delete-account" loading={isSubmitting}>
                Excluir definitivamente
              </Button>
            </>
          }
        >
          <form id="delete-account" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <Field label="Sua senha" error={errors.password?.message}>
              <PasswordInput autoComplete="current-password" {...register("password")} />
            </Field>
            <Field label='Digite "EXCLUIR" para confirmar' error={errors.confirmation?.message}>
              <Input autoComplete="off" autoCapitalize="characters" spellCheck={false} {...register("confirmation")} />
            </Field>
            {formError && <p role="alert" className="text-sm text-negative">{formError.message}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
