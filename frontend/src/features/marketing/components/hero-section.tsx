import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SIGNUP_CTA } from "../data";
import { ProductMockup } from "./product-mockup";

/** Respostas às objeções mais comuns, coladas no botão. */
const REASSURANCES = ["Sem cartão de crédito", "Importa extrato OFX e CSV", "Cancele quando quiser"];

export function HeroSection() {
  return (
    <section data-section="hero" className="relative overflow-hidden pb-20 pt-10 sm:pb-28 sm:pt-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-linear-to-b from-brass-soft/60 to-transparent" />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Gestão patrimonial pessoal</p>
          {/* Largo e sem lg:text-7xl: cada frase em 2 linhas, e o botão cabe na primeira tela de um notebook 1366×768. */}
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl">
            Tenha clareza total sobre o seu dinheiro.
            <span className="block text-balance italic text-ink-2">E transforme planejamento em patrimônio.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-ink-2 sm:text-lg">
            Receitas, despesas, cartões, metas, reserva e investimentos em uma única visão — com números explicados
            em linguagem simples, não em jargão financeiro.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <div className="relative isolate">
              <div aria-hidden className="bg-accent/45 absolute inset-0 -z-10 rounded-full blur-2xl" />
              <Link href="/cadastro" data-cta="hero" className={buttonVariants({ size: "lg" })}>
                {SIGNUP_CTA} <ArrowRight aria-hidden />
              </Link>
            </div>
            <a href="#produto" data-nav="hero" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Ver como funciona
            </a>
          </div>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-2">
            {REASSURANCES.map((r) => (
              <li key={r} className="flex items-center gap-1.5">
                <Check className="size-4 text-positive" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative isolate mx-auto mt-24 max-w-5xl px-5 sm:mt-28 sm:px-8">
        {/* Sol nascendo: leque de luz largo, ancorado bem na borda da prévia — mais claro e largo
            embaixo, afunilando pra cima, como o brilho se espalhando no horizonte. */}
        <div
          aria-hidden
          className="animate-rise pointer-events-none absolute left-1/2 bottom-full -z-10 h-[240px] w-screen -translate-x-1/2 sm:h-[380px]"
          style={{
            background:
              "radial-gradient(ellipse 55% 100% at 50% 100%, color-mix(in oklab, var(--brass), transparent 12%) 0%, color-mix(in oklab, var(--brass), transparent 62%) 42%, transparent 78%)",
            filter: "blur(36px)",
          }}
        />
        <ProductMockup />
      </div>
    </section>
  );
}
