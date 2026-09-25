import { cn } from "@/lib/cn";

/** Marca: o "L" apoiado na linha de lastro. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-7", className)} aria-hidden>
      <rect width="28" height="28" rx="8" className="fill-ink" />
      <path d="M10 7.5v11h8.5" fill="none" className="stroke-canvas" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 21.5h13" className="stroke-brass" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[1.375rem] leading-none tracking-[-0.01em] text-ink">Lastro</span>
    </span>
  );
}
