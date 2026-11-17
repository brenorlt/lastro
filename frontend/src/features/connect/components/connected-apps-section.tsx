"use client";

import { ArrowRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/primitives";
import { SettingsSection } from "@/components/ui/settings-section";
import { ConnectionsCard } from "./connect-parts";

/** Perfil → Apps conectados: quem tem acesso hoje; o passo a passo fica em /conectar-claude. */
export function ConnectedAppsSection() {
  return (
    <SettingsSection
      id="apps"
      title="Apps conectados"
      description="Apps que você autorizou a acessar sua conta. Você pode desligar qualquer um a qualquer momento."
    >
      <div className="space-y-4">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="bg-brass-soft text-brass flex size-10 shrink-0 items-center justify-center rounded-md">
            <MessagesSquare className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm font-medium">Use o Lastro conversando com o Claude</p>
            <p className="text-ink-2 text-sm">Pergunte, registre gastos e acompanhe metas sem abrir o app.</p>
          </div>
          <Link href="/conectar-claude" className={buttonVariants({ variant: "secondary", className: "shrink-0" })}>
            Como conectar <ArrowRight aria-hidden />
          </Link>
        </Card>
        <ConnectionsCard />
      </div>
    </SettingsSection>
  );
}
