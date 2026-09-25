import { Landmark, LineChart, Scale, Shield, Target, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BENEFITS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Wallet, title: "Saiba exatamente onde está seu dinheiro", description: "Cada real registrado, categorizado e somado — sem planilha, e com lançamentos recorrentes que se repetem sozinhos." },
  { icon: LineChart, title: "Planeje seus próximos meses", description: "Orçamento por categoria com alertas antes de estourar o limite, e um painel que mostra o mês inteiro em um relance." },
  { icon: Target, title: "Transforme objetivos em metas mensuráveis", description: "Diga o valor e o prazo — o Lastro calcula quanto guardar por mês e avisa se você está fora do ritmo." },
  { icon: Shield, title: "Construa sua reserva com um número real", description: "Defina quantos meses de proteção você quer e acompanhe o progresso até chegar lá." },
  { icon: Landmark, title: "Acompanhe a evolução do seu patrimônio", description: "Investimentos, imóveis, veículos e dívidas em um único retrato, mês a mês." },
  { icon: Scale, title: "Tenha uma visão consolidada da sua vida financeira", description: "Contas, cartões, investimentos e patrimônio conversando entre si — nunca em telas isoladas." },
];

export function BenefitsSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Benefícios</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            O resultado de usar o Lastro no dia a dia.
          </h2>
        </div>
        <ul className="mx-auto mt-14 grid max-w-5xl gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex flex-col items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <b.icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="text-base font-medium text-ink">{b.title}</h3>
              <p className="text-sm text-ink-2">{b.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
