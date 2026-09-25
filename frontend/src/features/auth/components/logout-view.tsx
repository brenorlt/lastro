"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authApi } from "../api";

export function LogoutView() {
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    authApi
      .logout()
      .catch(() => undefined)
      .finally(() => {
        queryClient.clear();
        setDone(true);
      });
  }, [queryClient]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      {done ? (
        <>
          <h1 className="text-xl font-semibold text-ink">Você saiu da sua conta</h1>
          <p className="mt-2 text-sm text-ink-2">Por segurança, a sessão deste dispositivo foi encerrada.</p>
          <Link href="/entrar" className={buttonVariants({ className: "mt-8" })}>
            Entrar novamente
          </Link>
        </>
      ) : (
        <p className="flex items-center gap-3 text-sm text-ink-2" role="status">
          <Spinner /> Encerrando sessão…
        </p>
      )}
    </main>
  );
}
