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
import { toast } from "@/components/ui/toaster";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { safeRedirect } from "@/lib/safe-redirect";
import { authApi } from "../api";
import { loginSchema, type LoginInput } from "../schemas";

const FIELDS = ["email", "password"] as const;

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), mode: "onTouched" });
  const { formError, setFormError, handle } = useApiFormErrors(setError, FIELDS);

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      const { user } = await authApi.login(values);
      const fallback = user.onboardingCompleted ? "/painel" : "/onboarding";
      router.replace(safeRedirect(next, fallback));
    } catch (err) {
      handle(err);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification(getValues("email"));
      toast.success("Link enviado", { description: "Confira sua caixa de entrada e o spam." });
    } catch (err) {
      handle(err);
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {notice && !formError && <FormAlert tone="success">{notice}</FormAlert>}
      {formError && (
        <FormAlert
          action={
            formError.code === "EMAIL_NOT_VERIFIED" && (
              <Button variant="link" size="sm" onClick={resend} loading={resending} className="h-auto text-xs">
                Reenviar link de confirmação
              </Button>
            )
          }
        >
          {formError.message}
        </FormAlert>
      )}
      <Field label="E-mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" {...register("email")} />
      </Field>
      <div className="space-y-2">
        <Field label="Senha" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
        <div className="text-right">
          <Link href="/recuperar-senha" className="text-xs font-medium text-accent hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Entrar
      </Button>
      <p className="text-center text-sm text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-accent hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
