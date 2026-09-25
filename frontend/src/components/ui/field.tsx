"use client";

import { Label as LabelPrimitive } from "radix-ui";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: LabelPrimitive.LabelProps) {
  return <LabelPrimitive.Root className={cn("text-sm font-medium text-ink", className)} {...props} />;
}

interface FieldProps {
  label: string;
  /** Texto de apoio exibido sob o campo. Substituído pela mensagem de erro quando houver. */
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}

/**
 * Envolve qualquer controle, ligando rótulo, dica e erro via ARIA.
 * O filho recebe id, aria-describedby e aria-invalid automaticamente.
 */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-2xs text-ink-3">Opcional</span>}
      </div>
      {control}
      {(error || hint) && (
        <p id={hintId} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-negative" : "text-ink-3")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
