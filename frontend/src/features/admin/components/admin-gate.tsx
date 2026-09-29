"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/primitives";
import { refreshSession } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Mesma checagem de sessão do SessionGate, mais o filtro por `role = ADMIN`.
 * É só UX: a barreira real é o AdminGuard da API (403 em qualquer rota /admin/*).
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
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
    } else if (status === "authenticated" && user && user.role !== "ADMIN") {
      router.replace("/painel");
    }
  }, [status, user, router, pathname]);

  if (status !== "authenticated" || !user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-5">
          <LogoMark className="size-9 animate-pulse" />
          <Skeleton className="h-1 w-24 rounded-full" />
          <span className="sr-only">Verificando acesso</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
