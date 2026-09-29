"use client";

import { AlertCircle, Banknote, Clock3, Users } from "lucide-react";
import { BarChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { Badge, Card, CardBody, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { AdminPayment, BillingPaymentStatus } from "@/types/admin";
import { useAdminOverview } from "../api";

const PAYMENT_STATUS_TONE: Record<BillingPaymentStatus, "positive" | "warning" | "negative"> = {
  PAID: "positive",
  PENDING: "warning",
  FAILED: "negative",
  EXPIRED: "negative",
  REFUNDED: "negative",
};

const PAYMENT_STATUS_LABEL: Record<BillingPaymentStatus, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
};

function SummaryCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-3">{label}</p>
          <p className="num mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-3">
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
      </CardBody>
    </Card>
  );
}

function RecentPaymentRow({ payment }: { payment: AdminPayment }) {
  return (
    <TR>
      <TD>
        <p className="truncate font-medium text-ink">{payment.userName}</p>
        <p className="truncate text-xs text-ink-3">{payment.userEmail}</p>
      </TD>
      <TD className="text-ink-2">{payment.method === "PIX" ? "Pix" : "Boleto"}</TD>
      <TD>
        <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
      </TD>
      <TD align="right">{formatCurrency(payment.amount)}</TD>
      <TD align="right" className="text-ink-3">{formatDate(payment.createdAt, "short")}</TD>
    </TR>
  );
}

export function OverviewView() {
  const overview = useAdminOverview();

  if (overview.isPending) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton className="h-16 w-full" />
              </CardBody>
            </Card>
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <Card>
        <ErrorState description={userMessage(overview.error)} onRetry={() => void overview.refetch()} />
      </Card>
    );
  }

  const d = overview.data;
  const chartRows = d.signupsByDay.map((s) => ({ date: formatDate(s.date, "short"), cadastros: s.count }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Users} label="Usuários" value={String(d.totalUsers)} hint={`${d.activeCount} com acesso ativo`} />
        <SummaryCard icon={Banknote} label="MRR estimado" value={formatCurrency(d.mrrEstimate)} hint={`${d.activeCount} assinaturas ativas`} />
        <SummaryCard icon={Clock3} label="Em trial" value={String(d.trialingCount)} />
        <SummaryCard icon={AlertCircle} label="Pagamentos pendentes" value={String(d.pendingPayments)} hint={`${d.blockedCount} contas bloqueadas`} />
      </div>

      <ChartCard title="Novos usuários" takeaway={`Últimos ${d.signupsByDay.length} dias`}>
        <BarChart
          data={chartRows}
          xKey="date"
          series={[{ key: "cadastros", label: "Cadastros", color: "var(--series-1)" }]}
          ariaLabel="Novos usuários por dia"
          valueFormatter={(v) => String(v)}
          yTickFormatter={(v) => String(v)}
          yAllowDecimals={false}
        />
      </ChartCard>

      <Card>
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <h3 className="text-sm font-medium text-ink">Pagamentos recentes</h3>
        </div>
        {d.recentPayments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3 sm:px-6">Nenhum pagamento ainda.</p>
        ) : (
          <Table className="mt-2">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Usuário</TH>
                <TH>Método</TH>
                <TH>Status</TH>
                <TH align="right">Valor</TH>
                <TH align="right">Data</TH>
              </TR>
            </THead>
            <TBody>
              {d.recentPayments.map((p) => (
                <RecentPaymentRow key={p.id} payment={p} />
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
