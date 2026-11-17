import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import { AdminGate } from "@/features/admin/components/admin-gate";
import { AdminShell } from "@/features/admin/components/admin-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AdminGate>
        <AdminShell>{children}</AdminShell>
      </AdminGate>
    </Providers>
  );
}
