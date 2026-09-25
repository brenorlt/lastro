import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ComponentsSection } from "@/features/design-system/sections/components";
import { DashboardPreviewSection } from "@/features/design-system/sections/dashboard-preview";
import { FoundationsSection } from "@/features/design-system/sections/foundations";

export const metadata: Metadata = { title: "Design System", robots: { index: false } };

const TOC = [
  ["cores", "Cores"],
  ["tipografia", "Tipografia"],
  ["espaco", "Espaço e elevação"],
  ["botoes", "Ações"],
  ["formularios", "Formulários"],
  ["overlays", "Modais e drawers"],
  ["dados", "Dados"],
  ["navegacao", "Navegação"],
  ["estados", "Estados"],
  ["painel", "Prévia do Painel"],
] as const;

export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] gap-12 px-4 sm:px-8">
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col py-10 lg:flex">
        <Logo />
        <p className="mt-2 text-xs text-ink-3">Design System · v0.1</p>
        <nav aria-label="Seções do Design System" className="mt-10 space-y-0.5">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-sm px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-sunken hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <Link href="/painel" className="mt-auto flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Ir para o app
        </Link>
      </aside>
      <main className="min-w-0 flex-1 space-y-16 py-10 sm:py-14">
        <header className="max-w-2xl">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="font-display text-5xl leading-none tracking-[-0.02em] text-ink">Design System</h1>
          <p className="mt-4 text-base text-ink-2">
            Segurança, patrimônio e clareza. Uma interface silenciosa, em que o único gesto de ousadia é o número do seu
            patrimônio apoiado na <em className="text-brass not-italic">linha de lastro</em>.
          </p>
        </header>
        <FoundationsSection />
        <ComponentsSection />
        <DashboardPreviewSection />
      </main>
    </div>
  );
}
