"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { userMessage } from "@/services/api-error";
import { authApi } from "../api";

/** Confirmação de envio. Mesma mensagem exista ou não a conta (anti-enumeração). */
export function CheckInbox({ email, kind }: { email: string; kind: "verify" | "reset" }) {
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try {
      await (kind === "verify" ? authApi.resendVerification(email) : authApi.forgotPassword(email));
      toast.success("Enviamos um novo link");
    } catch (err) {
      toast.error(userMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div role="status" className="space-y-6">
      <div className="rounded-lg bg-surface p-5 ring-1 ring-line">
        <MailCheck className="mb-3 size-5 text-positive" aria-hidden />
        <p className="text-sm text-ink">
          {kind === "verify"
            ? "Se o e-mail puder ser usado, você receberá um link de confirmação em "
            : "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha em "}
          <strong className="font-medium">{email}</strong>.
        </p>
        <p className="mt-2 text-xs text-ink-3">
          {kind === "verify" ? "O link expira em 24 horas." : "O link expira em 1 hora."} Confira também o spam.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={resend} loading={sending}>
          Reenviar link
        </Button>
        <Link href="/entrar" className="text-sm font-medium text-accent hover:underline">
          Ir para o login
        </Link>
      </div>
    </div>
  );
}
