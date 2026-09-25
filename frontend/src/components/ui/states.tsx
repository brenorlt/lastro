import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Explique o que aparecerá aqui e por que importa — empty states educam. */
  description: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-16", className)}>
      <div className="relative mb-5 flex size-12 items-center justify-center rounded-lg bg-surface-sunken text-ink-2">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        <span aria-hidden className="absolute -bottom-2 left-1/2 h-px w-16 -translate-x-1/2 bg-linear-to-r from-transparent via-brass/50 to-transparent" />
      </div>
      <h3 className="text-base font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-2">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  /** Mensagem já traduzida para o usuário. Nunca detalhes técnicos. */
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Não foi possível carregar",
  description = "Verifique sua conexão e tente novamente. Seus dados estão seguros.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-negative-soft text-negative">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <h3 className="text-base font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-2">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
