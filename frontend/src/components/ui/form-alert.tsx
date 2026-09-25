import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  error: { icon: AlertCircle, cls: "bg-negative-soft text-negative" },
  success: { icon: CheckCircle2, cls: "bg-positive-soft text-positive" },
  info: { icon: Info, cls: "bg-accent-soft text-accent" },
};

/** Mensagem no nível do formulário (credenciais, bloqueio, link expirado). */
export function FormAlert({
  tone = "error",
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-md px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-ink">{children}</p>
        {action}
      </div>
    </div>
  );
}
