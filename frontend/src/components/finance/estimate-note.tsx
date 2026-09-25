import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/** Marca obrigatória em qualquer valor projetado. Projeção nunca é promessa. */
export function EstimateBadge({ className }: { className?: string }) {
  return (
    <Badge tone="outline" className={cn("border-dashed", className)} title="Valor estimado a partir das premissas informadas">
      <Sparkles aria-hidden />
      Projeção
    </Badge>
  );
}

export function EstimateDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-ink-3", className)}>
      Projeções são estimativas baseadas nas premissas que você definiu. Não representam garantia de rentabilidade ou
      resultado.
    </p>
  );
}
