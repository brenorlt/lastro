"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { useBillingStatus } from "../api";

const BILLING_PATH = "/assinatura";

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const days = daysLeft(trialEndsAt);
  return (
    <Link
      href={BILLING_PATH}
      className="flex items-center justify-center gap-2 bg-accent-soft px-4 py-2 text-center text-xs font-medium text-accent hover:underline"
    >
      Seu teste grátis termina em {days} {days === 1 ? "dia" : "dias"} — assinar agora
    </Link>
  );
}

/**
 * Barreira de UX: redireciona para /assinatura quando a assinatura está bloqueada.
 * Só conveniência — a barreira real é o SubscriptionGuard da API (mesmo espírito do
 * SessionGate/JwtAuthGuard).
 */
export function BillingGate({ children }: { children: ReactNode }) {
  const status = useBillingStatus();
  const router = useRouter();
  const pathname = usePathname();
  const isBillingPage = pathname === BILLING_PATH;

  useEffect(() => {
    if (status.data?.status === "BLOCKED" && !isBillingPage) {
      router.replace(BILLING_PATH);
    }
  }, [status.data?.status, isBillingPage, router]);

  if (status.isPending) {
    return (
      <div className="space-y-3 p-6" aria-busy="true">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (status.data?.status === "BLOCKED" && !isBillingPage) return null;

  return (
    <>
      {status.data?.status === "TRIALING" && status.data.trialEndsAt && (
        <TrialBanner trialEndsAt={status.data.trialEndsAt} />
      )}
      {children}
    </>
  );
}
