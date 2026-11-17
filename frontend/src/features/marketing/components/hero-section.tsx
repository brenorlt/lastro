import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { MONTHLY_PRICE, SIGNUP_CTA, TRIAL_DAYS } from "../data";
import { ProductMockup } from "./product-mockup";

/** Respostas às objeções mais comuns, coladas no botão. */
const REASSURANCES = ["Sem cartão de crédito", "Sem conectar seu banco", "Cancele quando quiser"];

/** Fatos do produto (não depoimentos): a prova que dá para dar com honestidade antes de ter clientes. */
const PROOF = [
  { value: "0", label: "senhas de banco pedidas a você" },
  { value: `${TRIAL_DAYS} dias`, label: "com tudo liberado, de graça" },
  { value: `R$ ${MONTHLY_PRICE}`, label: "por mês depois, tudo incluso" },
];

export function HeroSection() {
  return (
    <section data-section="hero" className="relative isolate overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24">
      {/* Grade sutil + brilho: textura de "extrato" atrás do título, só CSS. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_30%,transparent_75%)] [background-size:56px_56px] opacity-[0.35]"
      />
      <div
        aria-hidden
        className="from-brass-soft/70 pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-linear-to-b to-transparent"
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <a
            href="#produto"
            data-nav="hero-pill"
            className="animate-rise border-line bg-surface/60 text-ink-2 hover:text-ink hover:border-line-strong inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors"
          >
            <Sparkles className="text-brass size-3.5" aria-hidden />
            Importe o extrato de qualquer banco<span className="hidden sm:inline"> em segundos</span>
            <ArrowRight className="size-3.5" aria-hidden />
          </a>

          <h1 className="font-display text-ink mt-6 text-[2.6rem] leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.25rem]">
            Saiba para onde vai cada real.
            <span className="text-brass block italic">E decida para onde vai o próximo.</span>
          </h1>

          <p className="text-ink-2 mx-auto mt-6 max-w-2xl text-base sm:text-xl sm:leading-8">
            Contas, cartões, metas, reserva e investimentos numa tela só. Importe o extrato do seu banco e veja o mês
            inteiro em minutos — <span className="text-ink">sem planilha e sem entregar a senha do banco</span>.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <div className="relative isolate w-full sm:w-auto">
              <div aria-hidden className="bg-accent/40 absolute inset-0 -z-10 rounded-full blur-2xl" />
              <Link
                href="/cadastro"
                data-cta="hero"
                className={cn(buttonVariants({ size: "lg" }), "cta-sheen h-14 w-full px-8 text-base sm:w-auto")}
              >
                {SIGNUP_CTA} <ArrowRight aria-hidden />
              </Link>
            </div>
            <a
              href="#produto"
              data-nav="hero"
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "h-14 px-6")}
            >
              Ver o produto por dentro
            </a>
          </div>

          <ul className="text-ink-2 mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {REASSURANCES.map((r) => (
              <li key={r} className="flex items-center gap-1.5">
                <Check className="text-positive size-4" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative isolate mx-auto mt-16 max-w-5xl px-5 sm:mt-20 sm:px-8">
        {/* Sol nascendo: leque de luz ancorado na borda da prévia. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-full left-1/2 -z-10 h-[240px] w-screen -translate-x-1/2 sm:h-[380px]"
          style={{
            background:
              "radial-gradient(ellipse 55% 100% at 50% 100%, color-mix(in oklab, var(--brass), transparent 20%) 0%, color-mix(in oklab, var(--brass), transparent 68%) 42%, transparent 78%)",
            filter: "blur(36px)",
          }}
        />
        <ProductMockup />
      </div>

      <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 px-5 text-center sm:mt-16 sm:px-8">
        {PROOF.map((p) => (
          <div key={p.label} className="flex flex-col-reverse gap-1">
            <dt className="text-ink-3 text-xs sm:text-sm">{p.label}</dt>
            <dd className="font-display text-ink num text-3xl tracking-tight sm:text-4xl">{p.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
