import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { PLANS, PRICE_PER_DAY, SIGNUP_CTA, TRIAL_DAYS } from "../data";
import { SectionHeading } from "./section-heading";

export function PricingSection() {
  const plan = PLANS[0];
  return (
    <section
      id="planos"
      data-section="planos"
      className="defer-render relative scroll-mt-20 overflow-hidden py-20 sm:py-28"
    >
      <div
        aria-hidden
        className="bg-accent/10 pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Preço"
          title={
            <>
              Menos de R$ 1 por dia. <span className="text-ink-2 italic">Tudo incluso.</span>
            </>
          }
          description="Um plano só, com todos os recursos. Sem versão limitada, sem upgrade escondido, sem fidelidade."
        />

        <div className="reveal mx-auto mt-14 max-w-4xl">
          <div className="bg-surface ring-accent/60 grid overflow-hidden rounded-3xl shadow-lg ring-2 md:grid-cols-[1fr_1.15fr]">
            <div className="border-line flex flex-col p-7 sm:p-9 md:border-r">
              <span className="bg-accent-soft text-accent w-fit rounded-full px-3 py-1 text-xs font-medium">
                {TRIAL_DAYS} dias grátis · sem cartão
              </span>
              <h3 className="text-ink mt-5 text-xl font-semibold">{plan.name}</h3>
              <p className="text-ink-2 mt-1 text-sm">{plan.tagline}</p>
              <p className="mt-7 flex items-baseline gap-1.5">
                <span className="text-ink-3 text-lg">R$</span>
                <span className="font-display num text-ink text-7xl leading-none tracking-tight">
                  {plan.monthlyPrice}
                </span>
                <span className="text-ink-3">/mês</span>
              </p>
              <p className="text-ink-2 mt-2 text-sm">
                São <strong className="text-ink font-medium">{PRICE_PER_DAY} por dia</strong> — menos que um cafezinho
                para nunca mais perguntar para onde foi o dinheiro.
              </p>
              <div className="mt-auto pt-8">
                <Link
                  href="/cadastro"
                  data-cta="planos"
                  className={cn(buttonVariants({ size: "lg" }), "cta-sheen h-14 w-full text-base")}
                >
                  {SIGNUP_CTA} <ArrowRight aria-hidden />
                </Link>
                <p className="text-ink-3 mt-3 text-center text-xs">
                  Nada é cobrado se você não assinar. Depois, Pix, boleto ou cartão.
                </p>
              </div>
            </div>
            <div className="bg-surface-sunken/50 p-7 sm:p-9">
              <p className="text-ink text-sm font-medium">Tudo isso, desde o primeiro dia:</p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-ink-2 flex items-start gap-2.5 text-sm">
                    <Check className="text-positive mt-0.5 size-4 shrink-0" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="text-ink-3 mt-8 text-center text-xs">
          Preços em reais, cobrança mensal. Impostos podem ser aplicados conforme a legislação vigente.
        </p>
      </div>
    </section>
  );
}
