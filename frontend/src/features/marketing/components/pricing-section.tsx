import { Check } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { PLANS } from "../data";

export function PricingSection() {
  return (
    <section id="planos" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Plano</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Um plano. Todos os recursos.
          </h2>
          <p className="mt-4 text-ink-2">Sem versões limitadas, sem upgrades escondidos. Sem multa, sem carência.</p>
        </div>
        <div className="mx-auto mt-14 flex max-w-md justify-center">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={cn(
                "flex w-full flex-col rounded-2xl bg-surface p-7 shadow-sm ring-1 ring-line",
                plan.featured && "relative ring-2 ring-accent shadow-lg",
              )}
            >
              {plan.featured && <Badge tone="accent" className="absolute -top-3 left-7">Acesso completo</Badge>}
              <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-2">{plan.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-sm text-ink-3">R$</span>
                <span className="num font-display text-4xl tracking-tight text-ink">{plan.monthlyPrice}</span>
                <span className="text-sm text-ink-3">/mês</span>
              </p>
              <Link href="/cadastro" className={buttonVariants({ variant: plan.featured ? "primary" : "secondary", className: "mt-6 w-full" })}>
                Começar com {plan.name}
              </Link>
              <ul className="mt-7 space-y-3 border-t border-line pt-7">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-xs text-ink-3">Preços em reais, cobrança mensal. Impostos podem ser aplicados conforme a legislação vigente.</p>
      </div>
    </section>
  );
}
