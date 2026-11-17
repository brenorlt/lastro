import type { ReactNode } from "react";

/** Página legal provisória: deixa claro que o texto definitivo ainda será publicado. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-ink-3 text-xs font-medium tracking-[0.14em] uppercase">Legal</p>
      <h1 className="font-display text-ink mt-3 text-4xl tracking-[-0.02em]">{title}</h1>
      <p className="text-ink-3 mt-2 text-sm">Última atualização: {updated}</p>
      <p className="text-ink-3 mt-1 text-sm">Lastro — CNPJ 54.798.718/0001-02</p>
      <div role="note" className="bg-warning-soft text-ink mt-8 rounded-lg px-4 py-3 text-sm">
        Documento em elaboração. A versão definitiva, revisada juridicamente, será publicada antes do lançamento
        comercial do Lastro. Abaixo, um resumo fiel de como o produto funciona hoje.
      </div>
      <div className="text-ink-2 [&_h2]:text-ink mt-10 space-y-6 text-sm leading-relaxed [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold">
        {children}
      </div>
    </article>
  );
}
