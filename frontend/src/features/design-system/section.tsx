import type { ReactNode } from "react";

export function DsSection({ id, eyebrow, title, description, children }: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line pt-12 first:border-0 first:pt-0">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function DsExample({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-3 text-xs font-medium text-ink-3">{label}</p>
      {children}
    </div>
  );
}
