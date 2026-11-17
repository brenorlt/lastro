import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import { AppShell } from "@/components/layout/app-shell";
import { SessionGate } from "@/features/auth/components/session-gate";
import { BillingGate } from "@/features/billing/components/billing-gate";

// Área privada: nunca indexada. proxy.ts filtra sem sessão; o JwtAuthGuard/SubscriptionGuard
// da API são a barreira real — SessionGate e BillingGate aqui são só UX.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <SessionGate>
        <BillingGate>
          <AppShell>{children}</AppShell>
        </BillingGate>
      </SessionGate>
    </Providers>
  );
}
