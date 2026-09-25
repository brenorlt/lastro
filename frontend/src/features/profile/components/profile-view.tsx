"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Separator } from "@/components/ui/primitives";
import { useAuthStore } from "@/stores/auth-store";
import { BillingSection } from "./billing-section";
import { DangerZone } from "./danger-zone";
import { NotificationsSection } from "./notifications-section";
import { PersonalSection } from "./personal-section";
import { PreferencesSection } from "./preferences-section";
import { SecuritySection } from "./security-section";

const SECTIONS = [
  ["dados", "Dados pessoais"],
  ["preferencias", "Preferências"],
  ["cobranca", "Plano e cobrança"],
  ["notificacoes", "Notificações"],
  ["seguranca", "Segurança"],
  ["excluir", "Excluir conta"],
] as const;

export function ProfileView() {
  // SessionGate garante o usuário antes de renderizar a área privada.
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <>
      <PageHeader title="Perfil e preferências" description="Seus dados, como o Lastro se comporta e quem tem acesso à sua conta." />
      <nav aria-label="Seções do perfil" className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-1.5">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="flex h-8 items-center rounded-full bg-surface px-3.5 text-xs font-medium text-ink-2 ring-1 ring-line hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-10">
        <PersonalSection user={user} />
        <Separator />
        <PreferencesSection user={user} />
        <Separator />
        <BillingSection />
        <Separator />
        <NotificationsSection user={user} />
        <Separator />
        <SecuritySection />
        <Separator />
        <DangerZone />
      </div>
    </>
  );
}
