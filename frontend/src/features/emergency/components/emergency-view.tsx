"use client";

import { ArrowDownUp, Settings2, Shield } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/finance/amount";
import { EstimateBadge, EstimateDisclaimer } from "@/components/finance/estimate-note";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { monthYear } from "@/features/goals/model";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import { useAdjustEmergencyFund, useEmergencyFund } from "../api";
import { AdjustDialogBody, EmergencyConfigDrawer } from "./emergency-config";

const monthsText = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${n === 1 ? "mês" : "meses"}`;

export function EmergencyView() {
  const hidden = useUiStore((s) => s.privacyMode);
  const query = useEmergencyFund();
  const adjust = useAdjustEmergencyFund();
  const [config, setConfig] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const f = query.data;

  return (
    <>
      <PageHeader
        title="Reserva financeira"
        description="Dinheiro guardado para imprevistos — perda de renda, saúde, reparos. É a base de qualquer planejamento."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Reserva" }]}
        actions={f ? <Button variant="secondary" onClick={() => setConfig(true)}><Settings2 aria-hidden /> Ajustar</Button> : undefined}
      />

      {query.isPending ? (
        <Card className="space-y-4 p-6" aria-busy="true" aria-label="Carregando reserva"><Skeleton className="h-12 w-56" /><Skeleton className="h-2 w-full" /><Skeleton className="h-20 w-full" /></Card>
      ) : query.isError ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : !f ? (
        <Card>
          <EmptyState
            icon={Shield}
            title="Configure sua reserva de emergência"
            description="Diga quanto custa seu mês e quantos meses quer proteger. Calculamos o objetivo, acompanhamos o progresso e estimamos quando você chega lá."
            action={<Button onClick={() => setConfig(true)}>Configurar reserva</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Card className="p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">Reserva atual</p>
            <Amount value={f.currentAmount} hidden={hidden} splitCents className="mt-3 block font-display text-5xl leading-none tracking-[-0.02em] text-ink" />
            <p className="num mt-3 text-sm text-ink-2">
              de {hidden ? "••••" : formatCurrency(f.targetAmount)} · {formatPercent(f.progress, { fractionDigits: 0 })}
            </p>
            <Progress className="mt-6" value={f.progress} tone={f.progress >= 100 ? "positive" : "brass"} label="Progresso da reserva" />

            <dl className="mt-8 grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-3">Cobertura</dt>
                <dd className="mt-1 text-lg font-semibold text-ink">{f.coverageMonths !== null ? monthsText(f.coverageMonths) : "—"}</dd>
                <dd className="text-2xs text-ink-3">de {monthsText(f.targetMonths)} desejados</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Falta</dt>
                <dd className="mt-1"><Amount value={f.remaining} hidden={hidden} className="text-lg font-semibold text-ink" /></dd>
                <dd className="text-2xs text-ink-3">custo mensal {hidden ? "••••" : formatCurrency(f.monthlyCost)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-ink-3">Previsão {f.projectedDate && <EstimateBadge />}</dt>
                <dd className="mt-1 text-lg font-semibold text-ink">{toNumber(f.remaining) <= 0 ? "Alcançada" : f.projectedDate ? monthYear(f.projectedDate) : "—"}</dd>
                <dd className="text-2xs text-ink-3">
                  {f.monthlyContribution ? `guardando ${formatCurrency(f.monthlyContribution)}/mês${f.monthsToTarget ? ` · ${monthsText(f.monthsToTarget)}` : ""}` : "defina um valor mensal"}
                </dd>
              </div>
            </dl>
            {f.projectedDate && <EstimateDisclaimer className="mt-6" />}
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Onde está guardada" />
              <CardBody>
                {f.mode === "LINKED" && f.linkedAccount ? (
                  <div className="flex items-center gap-3">
                    <EntityIcon icon={f.linkedAccount.icon} color={f.linkedAccount.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{f.linkedAccount.name}</p>
                      <p className="text-xs text-ink-3">O saldo da reserva acompanha esta conta.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-2">Valor informado por você. Atualize ao guardar ou retirar.</p>
                    <Button variant="secondary" onClick={() => setAdjusting(true)}><ArrowDownUp aria-hidden /> Guardar ou retirar</Button>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Como calculamos" />
              <CardBody className="space-y-2 text-sm text-ink-2">
                <p><strong className="font-medium text-ink">Objetivo</strong> = custo mensal × meses de proteção{f.customTarget ? " (você definiu um valor próprio)" : ""}.</p>
                <p><strong className="font-medium text-ink">Cobertura</strong> = reserva atual ÷ custo mensal: por quantos meses você se mantém sem renda.</p>
                <p className="text-xs text-ink-3">Deixe a reserva em aplicações de liquidez diária e baixo risco, separada do dinheiro do dia a dia.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {config && <EmergencyConfigDrawer open onOpenChange={setConfig} fund={f ?? null} />}
      <Dialog open={adjusting} onOpenChange={setAdjusting}>
        <DialogContent title="Movimentar reserva" description={f ? `Atual: ${formatCurrency(f.currentAmount)}` : undefined}>
          <AdjustDialogBody onDone={async (amount, note) => { await adjust.mutateAsync({ amount, note: note || undefined }); setAdjusting(false); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
