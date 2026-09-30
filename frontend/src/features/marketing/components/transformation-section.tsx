import { ArrowRight } from "lucide-react";

const PAIRS = [
  { before: "Confusão", after: "Clareza" },
  { before: "Gastos sem controle", after: "Planejamento" },
  { before: "Metas abstratas", after: "Objetivos mensuráveis" },
  { before: "Investimentos dispersos", after: "Patrimônio consolidado" },
];

export function TransformationSection() {
  return (
    <section data-section="transformacao" className="border-y border-line bg-surface-sunken/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brass">A transformação</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            De números soltos a uma direção clara.
          </h2>
        </div>
        <div className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-2 sm:gap-4">
          {PAIRS.map((p) => (
            <div key={p.before} className="flex items-center gap-4 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
              <span className="min-w-0 flex-1 text-sm text-ink-3 line-through decoration-line-strong">{p.before}</span>
              <ArrowRight className="size-4 shrink-0 text-brass" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{p.after}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
