import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { SIGNUP_CTA, TRIAL_DAYS } from "../data";

export function FinalCtaSection() {
  return (
    <section data-section="cta-final" className="defer-render px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="reveal bg-surface-sunken ring-line relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center ring-1 sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="from-brass/25 absolute inset-0 bg-radial-[ellipse_at_50%_120%] via-transparent to-transparent"
        />
        <div aria-hidden className="bg-brass/60 absolute inset-x-[20%] bottom-0 h-px" />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-brass text-xs font-medium tracking-[0.16em] uppercase">Comece hoje</p>
          <h2 className="font-display text-ink mt-4 text-4xl leading-[1.05] tracking-[-0.02em] sm:text-6xl">
            Daqui a um ano, você vai agradecer por ter começado <span className="italic">hoje</span>.
          </h2>
          <p className="text-ink-2 mx-auto mt-6 max-w-xl sm:text-lg">
            Leva poucos minutos para montar sua primeira visão. Os próximos {TRIAL_DAYS} dias são por nossa conta.
          </p>
          <div className="mt-10">
            <Link
              href="/cadastro"
              data-cta="cta-final"
              className={cn(
                buttonVariants({ size: "lg" }),
                "cta-sheen h-14 bg-white px-8 text-base text-black hover:bg-white/90",
              )}
            >
              {SIGNUP_CTA} <ArrowRight aria-hidden />
            </Link>
            <ul className="text-ink-3 mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
              {["Sem cartão de crédito", "Sem conectar seu banco", "Cancele quando quiser"].map((r) => (
                <li key={r} className="flex items-center gap-1.5">
                  <Check className="text-positive size-3.5" aria-hidden /> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
