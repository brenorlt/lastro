import { createElement } from "react";
import { cn } from "@/lib/cn";
import { getIcon } from "@/lib/icons";

const sizes = { sm: "size-8 rounded-sm [&_svg]:size-4", md: "size-10 rounded-md [&_svg]:size-[18px]", lg: "size-12 rounded-lg [&_svg]:size-5" };

/**
 * Ícone de conta/categoria com a cor escolhida pelo usuário. Fundo em 14% da cor e
 * traço misturado com a tinta, para manter contraste em qualquer cor e tema.
 */
export function EntityIcon({ icon, color, size = "md", className }: { icon: string; color: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", sizes[size], className)}
      style={{
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        color: `color-mix(in oklab, ${color} 72%, var(--ink))`,
      }}
    >
      {createElement(getIcon(icon), { strokeWidth: 1.9 })}
    </span>
  );
}
