"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Card, CardBody, Skeleton } from "@/components/ui/primitives";
import { SettingsSection } from "@/components/ui/settings-section";
import { ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useBillingStatus, useCancelSubscription } from "@/features/billing/api";

const STATUS_LABEL: Record<string, { label: string; tone: "positive" | "warning" | "negative" }> = {
  TRIALING: { label: "Em teste grátis", tone: "warning" },
  ACTIVE: { label: "Ativo", tone: "positive" },
  BLOCKED: { label: "Bloqueado", tone: "negative" },
  CANCELLED: { label: "Cancelado", tone: "negative" },
};

export function BillingSection() {
  const status = useBillingStatus();
  const cancel = useCancelSubscription();
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <SettingsSection id="cobranca" title="Plano e cobrança" description="Lastro Completo — um plano, todos os recursos.">
      <Card>
        <CardBody>
          {status.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : status.isError || !status.data ? (
            <ErrorState description={userMessage(status.error)} onRetry={() => void status.refetch()} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Badge tone={STATUS_LABEL[status.data.status].tone}>{STATUS_LABEL[status.data.status].label}</Badge>
                  R$ {status.data.planPrice.replace(".", ",")}/mês
                </p>
                <p className="text-xs text-ink-3">
                  {status.data.status === "TRIALING" && status.data.trialEndsAt
                    ? `Teste grátis até ${formatDate(status.data.trialEndsAt)}`
                    : status.data.currentPeriodEnd
                      ? `${status.data.hasRecurringSubscription ? "Renova" : "Vence"} em ${formatDate(status.data.currentPeriodEnd)}`
                      : "Nenhum pagamento ativo"}
                  {status.data.cancelAtPeriodEnd && " · cancelada, acesso até o fim do ciclo"}
                </p>
              </div>
              <div className="flex gap-2">
                {status.data.hasRecurringSubscription && !status.data.cancelAtPeriodEnd && (
                  <button
                    type="button"
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancelar assinatura
                  </button>
                )}
                <Link href="/assinatura" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Gerenciar pagamento
                </Link>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar a recorrência no cartão?"
        description="Sem multa: seu acesso continua ativo até o fim do ciclo já pago. Depois disso, a conta é bloqueada até um novo pagamento."
        confirmLabel="Cancelar assinatura"
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => {
              setConfirmCancel(false);
              toast.success("Assinatura cancelada");
            },
            onError: (err) => toast.error(userMessage(err)),
          })
        }
      />
    </SettingsSection>
  );
}
