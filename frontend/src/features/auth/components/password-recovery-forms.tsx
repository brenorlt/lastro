"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { authApi } from "../api";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "../schemas";
import { CheckInbox } from "./check-inbox";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });
  const { formError, handle } = useApiFormErrors(setError, ["email"] as const);

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    try {
      await authApi.forgotPassword(email);
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      handle(err);
    }
  };

  if (sentTo) return <CheckInbox email={sentTo} kind="reset" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <FormAlert>{formError.message}</FormAlert>}
      <Field label="E-mail da conta" error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Enviar link de redefinição
      </Button>
      <p className="text-center text-sm">
        <Link href="/entrar" className="font-medium text-accent hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), mode: "onTouched" });
  const { formError, handle } = useApiFormErrors(setError, ["password"] as const);

  if (!token) {
    return (
      <FormAlert action={<Link href="/recuperar-senha" className="text-xs font-medium text-accent hover:underline">Solicitar novo link</Link>}>
        Este link está incompleto. Abra novamente o link recebido por e-mail ou solicite outro.
      </FormAlert>
    );
  }

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    try {
      await authApi.resetPassword(token, password);
      router.replace("/entrar?aviso=senha-redefinida");
    } catch (err) {
      handle(err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && (
        <FormAlert
          action={
            formError.code === "TOKEN_INVALID" && (
              <Link href="/recuperar-senha" className="text-xs font-medium text-accent hover:underline">
                Solicitar novo link
              </Link>
            )
          }
        >
          {formError.message}
        </FormAlert>
      )}
      <Field label="Nova senha" hint="Mínimo de 10 caracteres, com letras e números." error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label="Confirme a nova senha" error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...register("confirm")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Salvar nova senha
      </Button>
    </form>
  );
}
