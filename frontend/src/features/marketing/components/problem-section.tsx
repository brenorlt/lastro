import { CircleDollarSign, Coins, ListX, ShieldOff, Target, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PROBLEMS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: ListX, title: "Não saber para onde o dinheiro vai", description: "O extrato passa, o cartão fecha, e o motivo de o saldo não sobrar continua um mistério." },
  { icon: TrendingDown, title: "Falta de planejamento", description: "Decisões financeiras tomadas no impulso, sem uma visão de médio e longo prazo." },
  { icon: Target, title: "Metas que nunca saem do papel", description: "Objetivos anotados, mas sem número, prazo ou plano — fáceis de adiar indefinidamente." },
  { icon: Coins, title: "Investimentos desorganizados", description: "Um pouco em cada corretora, sem visão consolidada de quanto realmente se tem." },
  { icon: ShieldOff, title: "Falta de reserva", description: "Um imprevisto e o plano inteiro desmonta, porque não há uma rede de proteção definida." },
  { icon: CircleDollarSign, title: "Falta de visão patrimonial", description: "Ativos, dívidas e investimentos espalhados, sem um retrato único de quanto se é dono." },
];

export function ProblemSection() {
  return (
    <section id="problema" data-section="problema" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">O problema</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Planilhas abandonadas. Apps que só mostram números soltos.
          </h2>
          <p className="mt-4 text-ink-2">Sinais comuns de quem ainda não tem clareza financeira — talvez você reconheça mais de um.</p>
        </div>
        <ul className="mx-auto mt-14 grid max-w-4xl gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p) => (
            <li key={p.title} className="flex flex-col items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-surface-sunken text-ink-2">
                <p.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="text-sm font-medium text-ink">{p.title}</h3>
              <p className="text-sm text-ink-2">{p.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
