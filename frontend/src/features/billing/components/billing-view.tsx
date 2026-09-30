"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useBillingStatus } from "../api";
import { CheckoutOptions } from "./checkout-options";

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function BillingView({ returnedFromCheckout = false }: { returnedFromCheckout?: boolean }) {
  // Na volta do checkout de cartão o webhook costuma chegar em segundos: confere o status
  // com frequência até o acesso liberar.
  const status = useBillingStatus({
    refetchInterval: (query) =>
      returnedFromCheckout && query.state.data?.status !== "ACTIVE" ? 4000 : false,
  });

  if (status.isPending) {
    return (
      <Card className="space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }
  if (status.isError || !status.data) {
    return (
      <Card>
        <ErrorState description={userMessage(status.error)} onRetry={() => void status.refetch()} />
      </Card>
    );
  }

  const s = status.data;
  const isTrialing = s.status === "TRIALING";
  const isBlocked = s.status === "BLOCKED";
  const isActive = s.status === "ACTIVE";

  return (
    <>
      <PageHeader
        title="Plano e cobrança"
        description={
          isTrialing
            ? `Seu teste grátis termina em ${s.trialEndsAt ? daysLeft(s.trialEndsAt) : 0} dias.`
            : isBlocked
              ? "Seu período de acesso acabou. Escolha uma forma de pagamento para continuar."
              : "Lastro Completo — todos os recursos, um preço único."
        }
      />

      {isActive && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">
                {s.hasRecurringSubscription ? "Assinatura ativa (renova sozinha)" : "Acesso ativo"}
              </p>
              <p className="text-sm text-ink-2">
                {s.currentPeriodEnd
                  ? `${s.hasRecurringSubscription ? "Próxima cobrança" : "Vence"} em ${formatDate(s.currentPeriodEnd)}`
                  : null}
                {s.cancelAtPeriodEnd && " · recorrência cancelada, acesso mantido até o fim do ciclo"}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {!isActive && returnedFromCheckout && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-sm text-ink-2">
              Recebemos seu retorno do checkout. Assim que o pagamento for confirmado, o acesso libera
              sozinho aqui.
            </p>
          </CardBody>
        </Card>
      )}

      {!isActive || s.cancelAtPeriodEnd ? <CheckoutOptions /> : null}
    </>
  );
}
