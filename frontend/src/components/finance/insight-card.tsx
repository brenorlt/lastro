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
  className?: string;
}

const iconTone = {
  neutral: "bg-surface-sunken text-ink-2",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
};

export function Insight({ icon: Icon, children, basis, tone = "neutral", className }: InsightProps) {
  return (
    <li className={cn("flex gap-3.5 py-4", className)}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", iconTone[tone])}>
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm text-ink [&_strong]:font-semibold [&_strong]:num">{children}</p>
        {basis && <p className="text-xs text-ink-3">{basis}</p>}
      </div>
    </li>
  );
}
