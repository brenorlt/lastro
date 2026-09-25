import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

type Tone = "accent" | "positive" | "warning" | "negative" | "brass";

const fill: Record<Tone, string> = {
  accent: "bg-accent",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  brass: "bg-brass",
};

/** Limiares de orçamento: 50% atenção, 80% alerta, 100% excedido. */
export function budgetTone(percent: number): Tone {
  if (percent >= 100) return "negative";
  if (percent >= 80) return "warning";
  return "accent";
}

interface ProgressProps {
  value: number;
  max?: number;
  tone?: Tone;
  /** Rótulo acessível: descreve o que está sendo medido. */
  label: string;
  size?: "sm" | "md";
  /** Marcas verticais em percentuais, ex.: [50, 80]. */
  markers?: number[];
  className?: string;
}

export function Progress({ value, max = 100, tone = "accent", label, size = "md", markers, className }: ProgressProps) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const width = Math.min(Math.max(percent, 0), 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={formatPercent(percent)}
      className={cn("relative w-full overflow-hidden rounded-full bg-surface-sunken", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill[tone])}
        style={{ width: `${width}%` }}
      />
      {markers?.map((m) => (
        <span key={m} aria-hidden className="absolute inset-y-0 w-0.5 bg-surface" style={{ left: `${m}%` }} />
      ))}
    </div>
  );
}
