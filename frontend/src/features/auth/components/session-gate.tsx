"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { LogoMark } from "@/components/brand/logo";
import { refreshSession } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Garante sessão válida antes de renderizar a área privada.
 * Ao carregar a página, o access token não existe (vive só em memória):
 * trocamos o cookie httpOnly de refresh por um novo. Sem sessão → /entrar?next=…
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (useAuthStore.getState().status !== "idle") return;
    useAuthStore.getState().setStatus("loading");
    void refreshSession().then((payload) => {
      if (!payload) useAuthStore.getState().clear();
    });
  }, []);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-5">
          <LogoMark className="size-9 animate-pulse" />
          <Skeleton className="h-1 w-24 rounded-full" />
          <span className="sr-only">Verificando sua sessão</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
