import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bloco de configurações: título/explicação à esquerda (desktop), conteúdo agrupado à direita. */
export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-24 grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10", className)}>
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Linha de configuração: rótulo + descrição à esquerda, controle à direita. */
export function SettingRow({ label, description, control, htmlFor }: { label: string; description?: string; control: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
