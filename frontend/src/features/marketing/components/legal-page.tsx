import type { ReactNode } from "react";

/** Página legal provisória: deixa claro que o texto definitivo ainda será publicado. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Legal</p>
      <h1 className="mt-3 font-display text-4xl tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-3">Última atualização: {updated}</p>
      <div role="note" className="mt-8 rounded-lg bg-warning-soft px-4 py-3 text-sm text-ink">
        Documento em elaboração. A versão definitiva, revisada juridicamente, será publicada antes do lançamento
        comercial do Lastro. Abaixo, um resumo fiel de como o produto funciona hoje.
      </div>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink">
        {children}
      </div>
    </article>
  );
}
