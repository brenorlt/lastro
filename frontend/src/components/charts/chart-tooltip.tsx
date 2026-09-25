"use client";

import { formatCurrency } from "@/lib/format";

export interface TooltipEntry {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => formatCurrency(v) }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-md bg-surface-raised px-3 py-2.5 text-xs shadow-lg ring-1 ring-line">
      {label !== undefined && <p className="mb-1.5 font-medium text-ink">{labelFormatter ? labelFormatter(label) : label}</p>}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.name)} className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-ink-2">{entry.name}</span>
            <span className="num ml-auto pl-3 font-medium text-ink">{valueFormatter(Number(entry.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
