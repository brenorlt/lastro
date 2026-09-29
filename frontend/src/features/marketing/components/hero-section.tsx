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
          <a
            href="#planos"
            className="border-line-strong/60 bg-surface-sunken/60 text-ink-2 hover:border-line-strong hover:text-ink mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs backdrop-blur-sm transition-colors"
          >
            <span aria-hidden className="bg-positive inline-block size-1.5 rounded-full" />
            7 dias grátis, acesso completo aos recursos
            <ArrowRight className="size-3" aria-hidden />
          </a>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Gestão patrimonial pessoal</p>
          <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl lg:text-7xl">
            Tenha clareza total sobre o seu dinheiro.
            <br />
            <span className="italic text-ink-2">E transforme planejamento em patrimônio.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-2">
            Receitas, despesas, cartões, metas, reserva e investimentos em uma única visão — com números explicados
            em linguagem simples, não em jargão financeiro.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <div className="relative isolate">
              <div aria-hidden className="bg-accent/45 absolute inset-0 -z-10 rounded-full blur-2xl" />
              <Link href="/cadastro" className={buttonVariants({ size: "lg" })}>
                Começar meu planejamento <ArrowRight aria-hidden />
              </Link>
            </div>
            <a href="#produto" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Ver como funciona
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-3">Sem cartão de crédito para começar. Cancele quando quiser.</p>
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
