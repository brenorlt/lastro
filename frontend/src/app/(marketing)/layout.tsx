import type { ReactNode } from "react";
import { MarketingAnalytics } from "@/features/marketing/components/marketing-analytics";
import { MarketingFooter } from "@/features/marketing/components/marketing-footer";
import { MarketingHeader } from "@/features/marketing/components/marketing-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    // Site institucional sempre escuro (identidade de marca), independente do tema
    // escolhido pela pessoa para o app logado — não mexe na preferência de sistema/perfil.
    <div className="dark bg-canvas flex min-h-dvh flex-col">
      <a
        href="#conteudo-principal"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-2 text-sm font-medium text-ink shadow-md ring-1 ring-line focus:not-sr-only"
      >
        Pular para o conteúdo
      </a>
      <MarketingHeader />
      <main id="conteudo-principal" tabIndex={-1} className="flex-1">{children}</main>
      <MarketingFooter />
      <MarketingAnalytics />
    </div>
  );
}
