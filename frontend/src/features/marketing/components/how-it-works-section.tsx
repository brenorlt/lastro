import { ArrowRight, FileUp, LayoutDashboard, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { TRIAL_DAYS } from "../data";
import { SectionHeading } from "./section-heading";

const STEPS: { icon: LucideIcon; title: string; description: string; when: string }[] = [
  {
    icon: UserPlus,
    title: "Crie sua conta",
    description: "Nome, e-mail e senha. Sem cartão de crédito. Um onboarding guiado monta o básico com você.",
    when: "Agora",
  },
  {
    icon: FileUp,
    title: "Traga sua realidade",
    description:
      "Cadastre contas e cartões e importe o extrato que você já baixa no app do banco. Recorrências se repetem sozinhas.",
    when: "Hoje",
  },
  {
    icon: LayoutDashboard,
    title: "Decida com clareza",
    description:
      "Abra o painel e veja o mês, as metas, a reserva e o patrimônio. A partir daqui, cada decisão tem um número por trás.",
    when: "Todo dia",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" data-section="como-funciona" className="defer-render scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Como funciona"
          tone="brass"
          title="Da bagunça à clareza em três passos."
          description="Sem conectar o banco e sem aprender uma ferramenta complicada."
        />

        <ol className="relative mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          <div
            aria-hidden
            className="via-brass/50 absolute top-[52px] right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent to-transparent md:block"
          />
          {STEPS.map((step, index) => (
            <li key={step.title} className="reveal bg-surface ring-line relative rounded-2xl p-6 ring-1">
              <div className="flex items-center justify-between">
                <span className="bg-brass-soft text-brass ring-canvas relative flex size-12 items-center justify-center rounded-xl ring-4">
                  <step.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-ink-3 text-2xs font-medium tracking-[0.12em] uppercase">
                  Passo {index + 1} · {step.when}
                </span>
              </div>
              <h3 className="text-ink mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="text-ink-2 mt-2 text-sm">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="reveal mt-12 text-center">
          <Link href="/cadastro" data-cta="como-funciona" className={cn(buttonVariants({ size: "lg" }), "h-13 px-7")}>
            Montar minha visão financeira <ArrowRight aria-hidden />
          </Link>
          <p className="text-ink-3 mt-3 text-xs">Grátis por {TRIAL_DAYS} dias, sem cartão de crédito.</p>
        </div>
      </div>
    </section>
  );
}
