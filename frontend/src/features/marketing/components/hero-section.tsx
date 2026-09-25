import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProductMockup } from "./product-mockup";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-linear-to-b from-brass-soft/60 to-transparent" />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Gestão patrimonial pessoal</p>
          <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl">
            Tenha clareza total sobre o seu dinheiro.
            <br />
            <span className="italic text-ink-2">E transforme planejamento em patrimônio.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-2">
            Receitas, despesas, cartões, metas, reserva e investimentos em uma única visão — com números explicados
            em linguagem simples, não em jargão financeiro.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/cadastro" className={buttonVariants({ size: "lg" })}>
              Começar meu planejamento <ArrowRight aria-hidden />
            </Link>
            <a href="#produto" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Ver como funciona
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-3">Sem cartão de crédito para começar. Cancele quando quiser.</p>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-5xl px-5 sm:px-8">
        <ProductMockup />
      </div>
    </section>
  );
}
