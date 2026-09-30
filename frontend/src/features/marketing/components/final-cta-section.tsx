import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SIGNUP_CTA } from "../data";

export function FinalCtaSection() {
  return (
    <section data-section="cta-final" className="bg-surface-sunken text-ink relative overflow-hidden py-20 sm:py-28">
      <div aria-hidden className="absolute inset-0 bg-linear-to-br from-brass/15 via-transparent to-transparent" />
      <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Comece hoje</p>
        <h2 className="mt-4 font-display text-3xl leading-tight tracking-[-0.02em] sm:text-5xl">
          Clareza sobre o seu dinheiro começa com uma decisão.
        </h2>
        <p className="text-ink-2 mx-auto mt-5 max-w-xl">
          Leve poucos minutos para montar sua primeira visão financeira. O resto do caminho o Lastro percorre com
          você.
        </p>
        <div className="mt-9">
          <Link
            href="/cadastro"
            data-cta="cta-final"
            className={buttonVariants({ size: "lg", className: "bg-white text-black hover:bg-white/90" })}
          >
            {SIGNUP_CTA} <ArrowRight aria-hidden />
          </Link>
          <p className="text-ink-3 mt-4 text-xs">Sem cartão de crédito. Cancele quando quiser.</p>
        </div>
      </div>
    </section>
  );
}
