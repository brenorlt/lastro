import { CreditCard, LineChart, Scale, Shield, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const HIGHLIGHTS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Scale, title: "Patrimônio", description: "Ativos menos passivos, sempre atualizados — a resposta imediata para “quanto eu realmente tenho?”." },
  { icon: Target, title: "Metas", description: "Cada objetivo com valor, prazo e o aporte mensal necessário para chegar lá no tempo certo." },
  { icon: Shield, title: "Reserva", description: "Quantos meses do seu custo de vida estão protegidos, com progresso visível a cada aporte." },
  { icon: CreditCard, title: "Cartões", description: "Fatura atual, próxima e limite disponível — parcelas organizadas automaticamente." },
  { icon: LineChart, title: "Investimentos", description: "Carteira por classe, rentabilidade e evolução dos aportes em um único lugar." },
];

export function DemoSection() {
  return (
    <section id="produto" data-section="produto" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">O produto</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Uma ferramenta sofisticada. Simples de usar todos os dias.
          </h2>
          <p className="mt-4 text-ink-2">O mesmo painel que você usará no dia seguinte à sua conta ser criada.</p>
        </div>
        <ul className="mx-auto mt-14 grid max-w-4xl gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex flex-col items-start gap-3 lg:col-span-1">
              <span className="flex size-10 items-center justify-center rounded-md bg-brass-soft text-brass">
                <h.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="text-sm font-medium text-ink">{h.title}</h3>
              <p className="text-sm text-ink-2">{h.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
