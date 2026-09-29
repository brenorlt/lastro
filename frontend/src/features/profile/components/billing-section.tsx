"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardBody, Skeleton } from "@/components/ui/primitives";
import { SettingsSection } from "@/components/ui/settings-section";
import { ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useBillingStatus } from "@/features/billing/api";

const STATUS_LABEL: Record<string, { label: string; tone: "positive" | "warning" | "negative" }> = {
  TRIALING: { label: "Em teste grátis", tone: "warning" },
  ACTIVE: { label: "Ativo", tone: "positive" },
  BLOCKED: { label: "Bloqueado", tone: "negative" },
  CANCELLED: { label: "Cancelado", tone: "negative" },
};

export function BillingSection() {
  const status = useBillingStatus();

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
                  R$ {status.data.planPrice.replace(".", ",")}
                </p>
                <p className="text-xs text-ink-3">
                  {status.data.status === "TRIALING" && status.data.trialEndsAt
                    ? `Teste grátis até ${formatDate(status.data.trialEndsAt)}`
                    : status.data.currentPeriodEnd
                      ? `Vence em ${formatDate(status.data.currentPeriodEnd)}`
                      : "Nenhum pagamento ativo"}
                </p>
              </div>
              <Link href="/assinatura" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Gerenciar pagamento
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </SettingsSection>
  );
}
