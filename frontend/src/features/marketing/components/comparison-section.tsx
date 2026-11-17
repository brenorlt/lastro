import { Check, Minus, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./section-heading";

type Cell = true | false | string;

/** Comparação justa: onde a alternativa resolve em parte, dizemos em que parte. */
const ROWS: { label: string; sheet: Cell; bank: Cell; lastro: Cell }[] = [
  {
    label: "Todas as contas e cartões numa visão só",
    sheet: "Se você digitar tudo",
    bank: "Só os daquele banco",
    lastro: true,
  },
  { label: "Fatura e parcelas organizadas sozinhas", sheet: false, bank: "Só o cartão dele", lastro: true },
  { label: "Importa extrato de qualquer banco", sheet: "Copiar e colar", bank: false, lastro: true },
  { label: "Orçamento com alerta antes de estourar", sheet: false, bank: false, lastro: true },
  { label: "Metas com aporte mensal calculado", sheet: "Se montar as fórmulas", bank: false, lastro: true },
  { label: "Reserva de emergência com número ideal", sheet: false, bank: false, lastro: true },
  { label: "Patrimônio: ativos menos dívidas", sheet: "Manual", bank: false, lastro: true },
  { label: "Projeções em três cenários", sheet: "Manual", bank: false, lastro: true },
];

function Value({ cell, highlight }: { cell: Cell; highlight?: boolean }) {
  if (cell === true)
    return (
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full",
          highlight ? "bg-action text-action-ink" : "bg-positive-soft text-positive",
        )}
      >
        <Check className="size-4" strokeWidth={2.5} aria-label="Sim" />
      </span>
    );
  if (cell === false) return <X className="text-ink-3/70 mx-auto size-4" aria-label="Não" />;
  return (
    <span className="text-ink-3 inline-flex items-center gap-1.5 text-xs">
      <Minus className="size-3.5 shrink-0" aria-hidden />
      {cell}
    </span>
  );
}

export function ComparisonSection() {
  return (
    <section
      id="comparativo"
      data-section="comparativo"
      className="defer-render border-line bg-surface-sunken/40 scroll-mt-20 border-y py-20 sm:py-28"
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Por que o Lastro"
          title="A planilha dá trabalho. O app do banco só vê um banco."
          description="O Lastro junta o que nenhum dos dois junta — e mantém atualizado sem você virar contador."
        />

        <div className="reveal mt-14 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Comparação entre planilha, app do banco e Lastro</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[40%] pb-4 text-left font-normal" />
                <th scope="col" className="text-ink-2 pb-4 text-center font-medium">
                  Planilha
                </th>
                <th scope="col" className="text-ink-2 pb-4 text-center font-medium">
                  App do banco
                </th>
                <th scope="col" className="bg-surface ring-line rounded-t-2xl px-4 pt-5 pb-4 text-center ring-1">
                  <span className="text-ink inline-flex items-center gap-2 font-semibold">
                    <LogoMark className="size-6" /> Lastro
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.label}>
                  <th scope="row" className="border-line text-ink border-t py-4 pr-4 text-left font-normal">
                    {r.label}
                  </th>
                  <td className="border-line border-t px-3 py-4 text-center">
                    <Value cell={r.sheet} />
                  </td>
                  <td className="border-line border-t px-3 py-4 text-center">
                    <Value cell={r.bank} />
                  </td>
                  <td
                    className={cn(
                      "bg-surface border-line border-t px-3 py-4 text-center shadow-[inset_1px_0_var(--line),inset_-1px_0_var(--line)]",
                      i === ROWS.length - 1 &&
                        "rounded-b-2xl shadow-[inset_1px_0_var(--line),inset_-1px_0_var(--line),inset_0_-1px_var(--line)]",
                    )}
                  >
                    <Value cell={r.lastro} highlight />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
