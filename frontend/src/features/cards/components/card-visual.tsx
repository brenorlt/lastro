import { cn } from "@/lib/cn";
import { brandLabel } from "../api";

/**
 * Representação do cartão físico: proporção ISO 7810 (85,6 × 54 mm), gradiente
 * derivado da cor escolhida e texto sempre claro sobre um véu escuro — contraste
 * garantido para qualquer cor.
 */
export function CardVisual({ name, brand, color, lastFour, institution, className, size = "md" }: {
  name: string;
  brand: string;
  color: string;
  lastFour?: string | null;
  institution?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      aria-hidden
      className={cn("relative aspect-[1.586] w-full overflow-hidden rounded-xl text-white shadow-md", size === "sm" ? "max-w-44" : "max-w-sm", className)}
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${color} 88%, white) 0%, ${color} 45%, color-mix(in oklab, ${color} 55%, black) 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-linear-to-t from-black/45 via-black/10 to-transparent" />
      <div className="absolute -right-10 -top-16 size-48 rounded-full bg-white/10" />
      <div className={cn("relative flex h-full flex-col justify-between", size === "sm" ? "p-3" : "p-5")}>
        <div className="flex items-start justify-between gap-2">
          <span className={cn("truncate font-medium opacity-90", size === "sm" ? "text-2xs" : "text-xs")}>{institution ?? name}</span>
          <span className={cn("shrink-0 font-semibold italic tracking-tight", size === "sm" ? "text-2xs" : "text-sm")}>{brandLabel(brand)}</span>
        </div>
        <div className={cn("h-6 w-8 rounded-[5px] bg-linear-to-br from-amber-100/90 to-amber-300/70", size === "sm" && "h-4 w-6")} />
        <div className="flex items-end justify-between gap-2">
          <span className={cn("truncate font-medium", size === "sm" ? "text-2xs" : "text-sm")}>{name}</span>
          <span className={cn("num shrink-0 tracking-[0.18em] opacity-90", size === "sm" ? "text-2xs" : "text-sm")}>•••• {lastFour ?? "••••"}</span>
        </div>
      </div>
    </div>
  );
}
