"use client";

import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui-store";
import type { MoneyInput } from "@/lib/format";
import { Amount } from "./amount";

interface StatTileProps {
  label: string;
  value: MoneyInput;
  icon?: LucideIcon;
  /** Explicação curta do que o número significa, em linguagem simples. */
  explainer?: string;
  footer?: ReactNode;
  flow?: "income" | "expense" | "neutral";
  className?: string;
}

export function StatTile({ label, value, icon: Icon, explainer, footer, flow, className }: StatTileProps) {
  const hidden = useUiStore((s) => s.privacyMode);
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <div className="flex items-center gap-2 text-xs text-ink-2">
        {Icon && <Icon className="size-4 text-ink-3" strokeWidth={1.75} aria-hidden />}
        <span>{label}</span>
        {explainer && (
          <Tooltip content={explainer}>
            <button type="button" className="ml-auto rounded-full text-ink-3 hover:text-ink" aria-label={`O que é ${label}?`}>
              <Info className="size-3.5" aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
      <Amount value={value} flow={flow} hidden={hidden} className="text-2xl font-semibold tracking-tight text-ink" />
      {footer && <div className="mt-auto">{footer}</div>}
    </Card>
  );
}
