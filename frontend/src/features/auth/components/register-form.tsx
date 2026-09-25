"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormAlert } from "@/components/ui/form-alert";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { authApi } from "../api";
import { registerSchema, type RegisterInput } from "../schemas";
import { CheckInbox } from "./check-inbox";

const FIELDS = ["name", "email", "password"] as const;

export function RegisterForm() {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), mode: "onTouched" });
  const { formError, setFormError, handle } = useApiFormErrors(setError, FIELDS);

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null);
    try {
      await authApi.register(values);
    } catch (err) {
      return handle(err);
    }
    // Se o backend não exigir confirmação de e-mail, entra direto. Qualquer falha aqui
    // (confirmação exigida, e-mail já cadastrado com outra senha) cai na mesma tela neutra.
    try {
      await authApi.login({ email: values.email, password: values.password });
      router.replace("/onboarding");
    } catch {
      setSentTo(values.email.trim().toLowerCase());
    }
  };

  if (sentTo) return <CheckInbox email={sentTo} kind="verify" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <FormAlert>{formError.message}</FormAlert>}
      <Field label="Nome" error={errors.name?.message}>
        <Input autoComplete="name" {...register("name")} />
      </Field>
      <Field label="E-mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Field>
      <Field label="Senha" hint="Mínimo de 10 caracteres, com letras e números." error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" {...register("password")} />
      </Field>
      <div className="space-y-1.5">
        <label className="flex items-start gap-2.5 text-sm text-ink-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded-xs accent-(--accent)"
            aria-invalid={errors.acceptTerms ? true : undefined}
            {...register("acceptTerms")}
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="font-medium text-accent hover:underline">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="font-medium text-accent hover:underline">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p role="alert" className="text-xs text-negative">
            {errors.acceptTerms.message}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Criar conta
      </Button>
      <p className="text-center text-sm text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
