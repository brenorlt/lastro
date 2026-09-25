"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export interface LegendItem {
  label: string;
  color: string;
  value?: string;
  dashed?: boolean;
}

interface ChartCardProps {
  title: string;
  /** A conclusão do gráfico em uma frase — o que a pessoa deve aprender dele. */
  takeaway?: ReactNode;
  legend?: LegendItem[];
  action?: ReactNode;
  /** Tabela equivalente, para leitores de tela e para quem prefere números. */
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, takeaway, legend, action, table, children, className }: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          {takeaway && <p className="text-xs text-ink-2">{takeaway}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
              className="flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-sunken hover:text-ink"
              aria-label={view === "chart" ? "Ver dados em tabela" : "Ver gráfico"}
              aria-pressed={view === "table"}
            >
              {view === "chart" ? <Table2 className="size-4" aria-hidden /> : <BarChart3 className="size-4" aria-hidden />}
            </button>
          )}
        </div>
      </div>
      {legend && legend.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-3 sm:px-6" aria-label="Legenda">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span
                aria-hidden
                className={cn("h-0.5 w-3 rounded-full", item.dashed && "border-t-2 border-dashed bg-transparent")}
                style={item.dashed ? { borderColor: item.color } : { background: item.color }}
              />
              {item.label}
              {item.value && <span className="num font-medium text-ink">{item.value}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1 px-2 pb-4 pt-4 sm:px-3">{view === "chart" || !table ? children : <div className="px-3">{table}</div>}</div>
    </Card>
  );
}
