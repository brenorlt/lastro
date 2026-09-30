import { ArrowRight, CheckCircle2, LayoutDashboard, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TRIAL_DAYS } from "../data";

const STEPS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: CheckCircle2,
    title: "Crie sua conta",
    description: "Comece sem cartão de crédito e siga o onboarding guiado para configurar sua primeira visão.",
  },
  {
    icon: WalletCards,
    title: "Organize sua realidade",
    description: "Cadastre contas e cartões, importe o extrato do banco em OFX ou CSV e defina os objetivos que importam para você.",
  },
  {
    icon: LayoutDashboard,
    title: "Decida com clareza",
    description: "Acompanhe orçamento, reserva, metas e patrimônio em um único painel, todos os dias.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" data-section="como-funciona" className="scroll-mt-20 border-y border-line bg-surface-sunken/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brass">Como funciona</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Sua primeira visão financeira em três passos.
          </h2>
          <p className="mt-4 text-ink-2">Sem conectar o banco e sem precisar aprender uma ferramenta complicada.</p>
        </div>

        <ol className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-xl bg-surface p-6 shadow-sm ring-1 ring-line">
              <span className="num text-xs font-medium text-brass">0{index + 1}</span>
              <span className="mt-5 flex size-11 items-center justify-center rounded-lg bg-brass-soft text-brass">
                <step.icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-5 text-base font-medium text-ink">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Link href="/cadastro" data-cta="como-funciona" className={buttonVariants({ size: "lg" })}>
            Montar minha visão financeira <ArrowRight aria-hidden />
          </Link>
          <p className="mt-3 text-xs text-ink-3">Grátis por {TRIAL_DAYS} dias, sem cartão de crédito.</p>
        </div>
      </div>
    </section>
  );
}
