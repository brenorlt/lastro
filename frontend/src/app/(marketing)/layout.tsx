import type { Viewport } from "next";
import type { ReactNode } from "react";
import { AnchorScrollFix } from "@/features/marketing/components/anchor-scroll-fix";
import { MarketingAnalytics } from "@/features/marketing/components/marketing-analytics";
import { MarketingFooter } from "@/features/marketing/components/marketing-footer";
import { MarketingHeader } from "@/features/marketing/components/marketing-header";

// A landing é sempre clara: a barra do navegador acompanha o canvas, mesmo com o sistema no escuro.
export const viewport: Viewport = { themeColor: "#e2e7f1" };

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    // Site institucional sempre claro, na paleta da marca (branco + verde + lima), independente do
    // tema escolhido para o app logado — não mexe na preferência de sistema/perfil.
    <div className="marketing-site bg-canvas text-ink flex min-h-dvh flex-col">
      <a
        href="#conteudo-principal"
        className="bg-surface text-ink ring-line sr-only fixed top-4 left-4 z-50 rounded-md px-4 py-2 text-sm font-medium shadow-md ring-1 focus:not-sr-only"
      >
        Pular para o conteúdo
      </a>
      <MarketingHeader />
      <main id="conteudo-principal" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <MarketingAnalytics />
      <AnchorScrollFix />
    </div>
  );
}
