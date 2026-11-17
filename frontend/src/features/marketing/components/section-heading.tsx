import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  /** brass só onde o assunto é patrimônio/marca; o resto usa tinta neutra. */
  tone?: "brass" | "muted";
  className?: string;
  id?: string;
}

/** Cabeçalho padrão das seções da landing: rótulo, título em serifa e apoio. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "muted",
  className,
  id,
}: SectionHeadingProps) {
  return (
    <div className={cn("reveal max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p
        className={cn(
          "text-xs font-medium tracking-[0.16em] uppercase",
          tone === "brass" ? "text-brass" : "text-ink-3",
        )}
      >
        {eyebrow}
      </p>
      <h2 id={id} className="font-display text-ink mt-3 text-3xl leading-[1.1] tracking-[-0.02em] sm:text-[2.75rem]">
        {title}
      </h2>
      {description && <p className="text-ink-2 mt-4 sm:text-lg">{description}</p>}
    </div>
  );
}
