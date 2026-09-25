"use client";

import { CheckCircle2, MailOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Spinner } from "@/components/ui/spinner";
import { userMessage } from "@/services/api-error";
import { authApi } from "../api";
import { AuthHeading } from "./auth-heading";

type State = { kind: "verifying" } | { kind: "done" } | { kind: "error"; message: string };

export function VerifyEmail({ token }: { token: string | null }) {
  const [state, setState] = useState<State>({ kind: "verifying" });
  const started = useRef(false);

  useEffect(() => {
    // Token é de uso único: o StrictMode monta duas vezes em dev.
    if (!token || started.current) return;
    started.current = true;
    authApi
      .verifyEmail(token)
      .then(() => setState({ kind: "done" }))
      .catch((err: unknown) => setState({ kind: "error", message: userMessage(err) }));
  }, [token]);

  if (!token) {
    return (
      <>
        <MailOpen className="mb-6 size-8 text-brass" strokeWidth={1.5} aria-hidden />
        <AuthHeading
          title="Confirme seu e-mail"
          description="Abra o link que enviamos para sua caixa de entrada. Ele expira em 24 horas e só pode ser usado uma vez."
        />
        <Link href="/entrar" className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}>
          Ir para o login
        </Link>
      </>
    );
  }

  if (state.kind === "verifying") {
    return (
      <div className="flex items-center gap-3 text-sm text-ink-2" role="status">
        <Spinner /> Confirmando seu e-mail…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <>
        <AuthHeading title="Não foi possível confirmar" />
        <FormAlert>{state.message}</FormAlert>
        <Link href="/entrar" className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-6 w-full" })}>
          Ir para o login e reenviar
        </Link>
      </>
    );
  }

  return (
    <>
      <CheckCircle2 className="mb-6 size-8 text-positive" strokeWidth={1.5} aria-hidden />
      <AuthHeading title="E-mail confirmado" description="Sua conta está pronta. Entre para montar sua primeira visão financeira." />
      <Link href="/entrar" className={buttonVariants({ size: "lg", className: "w-full" })}>
        Entrar
      </Link>
    </>
  );
}
