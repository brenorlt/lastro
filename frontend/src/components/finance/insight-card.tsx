import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface InsightProps {
  icon: LucideIcon;
  /** A frase principal, com o número em destaque via <strong>. */
  children: ReactNode;
  /** De onde vem o número — transparência sobre o cálculo. */
  basis?: string;
  tone?: "neutral" | "positive" | "warning";
  /** Número de destaque à direita (ex.: "+37,8%" e "gastos"). */
  highlight?: { value: string; label: string } | null;
  className?: string;
}

const iconTone = {
  neutral: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
};

const highlightTone = {
  neutral: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
};

export function Insight({ icon: Icon, children, basis, tone = "neutral", highlight, className }: InsightProps) {
  return (
    <li className={cn("flex gap-3.5 py-4", className)}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", iconTone[tone])}>
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm text-ink [&_strong]:font-semibold [&_strong]:num">{children}</p>
        {basis && <p className="text-xs text-ink-3">{basis}</p>}
      </div>
      {highlight && (
        // Só com espaço (container query): em cards estreitos a frase já traz o número em negrito.
        <span aria-hidden className={cn("hidden h-fit shrink-0 flex-col items-end rounded-md px-2 py-1 @xs:flex", highlightTone[tone])}>
          <span className="num text-sm font-semibold leading-tight">{highlight.value}</span>
          <span className="text-2xs leading-tight opacity-80">{highlight.label}</span>
        </span>
      )}
    </li>
  );
}
