import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SessionGate } from "@/features/auth/components/session-gate";

// Área privada: nunca indexada. proxy.ts filtra sem sessão; o JwtAuthGuard da API é a barreira real.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
