"use client";

import { ArrowLeftRight, Check, PiggyBank, Receipt, Shield, Sparkles, Target, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { BarChart, DonutChart, LineChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { Amount } from "@/components/finance/amount";
import { Insight } from "@/components/finance/insight-card";
import { Button, IconButton } from "@/components/ui/button";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { dayLabel, isFuture } from "@/lib/dates";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { paymentStatusKind } from "@/features/transactions/components/payment-status";
import { useOpenTransaction } from "@/features/transactions/use-open-transaction";
import { useComposer } from "@/stores/composer-store";
import type { Dashboard, DashboardInsight } from "@/types/dashboard";
import type { Transaction } from "@/types/finance";
import { useToggleCleared } from "@/features/transactions/api";
import { shortMonth, tickerHeadline } from "../api";

const INSIGHT_ICONS: Record<string, typeof Sparkles> = {
  SAVINGS_RATE: PiggyBank,
  EMERGENCY_COVERAGE: Shield,
  TOP_CATEGORY: Receipt,
  OVERDUE: TriangleAlert,
};

/** Variações (gasto/renda) apontam para onde o número foi. */
export function insightIcon(insight: DashboardInsight) {
  if (insight.key === "SPENDING_CHANGE" || insight.key === "INCOME_CHANGE") {
    return (insight.value ?? 0) > 0 ? TrendingUp : TrendingDown;
  }
  return INSIGHT_ICONS[insight.key] ?? Sparkles;
}

/** Frases vindas da API; números destacados em negrito para leitura rápida. */
export function emphasize(message: string) {
  const parts = message.split(/(R\$\s?[\d.,]+|\d+(?:,\d+)?\s?%|\d+(?:,\d+)?\s(?:meses|mês|lançamentos?))/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

export function InsightsCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <Card>
      <CardHeader title="Inteligência financeira" description="Calculado a partir dos seus próprios lançamentos" />
      {insights.length === 0 ? (
        <p className="px-5 pb-6 pt-3 text-sm text-ink-2 sm:px-6">
          Registre receitas e despesas deste mês para ver aqui sua taxa de poupança, a cobertura da reserva e para onde vai seu dinheiro.
        </p>
      ) : (
        <ul className="@container divide-y divide-line px-5 sm:px-6">
          {insights.map((i) => (
            <Insight key={i.key} icon={insightIcon(i)} tone={i.tone} basis={i.basis} highlight={tickerHeadline({ source: "personal", insight: i })}>
              {emphasize(i.message)}
            </Insight>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Table>
      <THead><TR className="hover:bg-transparent">{head.map((h, i) => <TH key={h} align={i === 0 ? "left" : "right"}>{h}</TH>)}</TR></THead>
      <TBody>
        {rows.map((r) => (
          <TR key={String(r[0])}>{r.map((c, i) => <TD key={i} align={i === 0 ? "left" : "right"} className="h-10">{typeof c === "number" ? formatCurrency(c) : c}</TD>)}</TR>
        ))}
      </TBody>
    </Table>
  );
}

export function NetWorthChart({ data }: { data: Dashboard }) {
  const series = data.series.netWorth.map((p) => ({ month: shortMonth(p.month), patrimonio: toNumber(p.value) }));
  const first = series[0]?.patrimonio ?? 0;
  const last = series.at(-1)?.patrimonio ?? 0;
  const diff = last - first;
  const flat = series.every((p) => p.patrimonio === first);
  return (
    <ChartCard
      className="lg:col-span-2"
      title="Evolução patrimonial"
      takeaway={flat ? "Sua evolução aparece aqui conforme você registra lançamentos." : `Seu patrimônio ${diff >= 0 ? "cresceu" : "recuou"} ${formatCurrency(Math.abs(diff))} em ${series.length} meses.`}
      table={<MiniTable head={["Mês", "Patrimônio"]} rows={series.map((r) => [r.month, r.patrimonio])} />}
    >
      <LineChart
        data={series}
        xKey="month"
        domain={["auto", "auto"]}
        series={[{ key: "patrimonio", label: "Patrimônio líquido", color: "var(--brass)" }]}
        ariaLabel={`Patrimônio líquido nos últimos ${series.length} meses, de ${formatCurrency(first)} para ${formatCurrency(last)}`}
        height={260}
      />
      {data.series.netWorthMethod === "reconstructed" && (
        <p className="px-3 pt-2 text-2xs text-ink-3">Meses anteriores estimados a partir dos lançamentos registrados.</p>
      )}
    </ChartCard>
  );
}

export function SpendingChart({ data }: { data: Dashboard }) {
  const slices = data.series.spendingByCategory;
  const total = slices.reduce((s, c) => s + toNumber(c.amount), 0);
  const top = slices[0];
  return (
    <ChartCard
      title="Distribuição de gastos"
      takeaway={top ? `${top.name} concentra ${formatPercent(top.share, { fractionDigits: 0 })} das despesas.` : "Sem despesas neste mês."}
      table={slices.length ? <MiniTable head={["Categoria", "Valor"]} rows={slices.map((c) => [c.name, toNumber(c.amount)])} /> : undefined}
    >
      {slices.length === 0 ? (
        <p className="px-3 py-12 text-center text-sm text-ink-3">Suas despesas por categoria aparecem aqui.</p>
      ) : (
        <>
          <DonutChart
            data={slices.map((c, i) => ({ id: c.categoryId ?? `outros-${i}`, label: c.name, value: toNumber(c.amount) }))}
            colors={slices.map((c) => c.color)}
            ariaLabel="Despesas do mês por categoria"
            centerValue={formatCurrency(total, { compact: true })}
            centerLabel="no mês"
            size={176}
          />
          <ul className="mt-5 space-y-2 px-3">
            {slices.map((c, i) => (
              <li key={c.categoryId ?? `outros-${i}`} className="flex items-center gap-2 text-xs">
                <EntityIcon icon={c.icon} color={c.color} className="size-5 rounded-[5px] [&_svg]:size-3" />
                <span className="truncate text-ink-2">{c.name}</span>
                <span className="num ml-auto font-medium text-ink">{formatCurrency(c.amount)}</span>
                <span className="num w-9 text-right text-ink-3">{Math.round(c.share)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}

export function CashflowChart({ data }: { data: Dashboard }) {
  const rows = data.series.cashflow.map((r) => ({ month: shortMonth(r.month), receitas: toNumber(r.income), despesas: toNumber(r.expense) }));
  const positive = rows.filter((r) => r.receitas > 0 || r.despesas > 0);
  const surplusMonths = positive.filter((r) => r.receitas >= r.despesas).length;
  return (
    <ChartCard
      className="lg:col-span-2"
      title="Receitas x despesas"
      takeaway={positive.length === 0 ? "Sem movimentações nos últimos meses." : `Em ${surplusMonths} de ${positive.length} meses você gastou menos do que ganhou.`}
      legend={[
        { label: "Receitas", color: "var(--positive)" },
        { label: "Despesas", color: "var(--ink-3)" },
      ]}
      table={<MiniTable head={["Mês", "Receitas", "Despesas"]} rows={rows.map((r) => [r.month, r.receitas, r.despesas])} />}
    >
      <BarChart
        data={rows}
        xKey="month"
        series={[
          { key: "receitas", label: "Receitas", color: "var(--positive)" },
          { key: "despesas", label: "Despesas", color: "var(--ink-3)" },
        ]}
        ariaLabel="Receitas e despesas dos últimos 6 meses"
      />
    </ChartCard>
  );
}

export function GoalsCard({ goals }: { goals: Dashboard["goals"] }) {
  return (
    <Card>
      <CardHeader title="Metas" description={goals.length ? "Progresso e quanto guardar por mês" : undefined} action={<Button variant="ghost" size="sm" asChild><Link href="/metas">Ver todas</Link></Button>} />
      <CardBody className="space-y-5">
        {goals.length === 0 ? (
          <div className="flex items-start gap-3 text-sm text-ink-2">
            <Target className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            Transforme um objetivo em uma meta com valor e prazo — calculamos quanto guardar por mês.
          </div>
        ) : (
          goals.map((g) => (
            <div key={g.id} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-ink">{g.name}</span>
                <span className="num shrink-0 text-xs text-ink-2">{formatPercent(g.progress, { fractionDigits: 0 })}</span>
              </div>
              <Progress value={toNumber(g.currentAmount)} max={Math.max(toNumber(g.targetAmount), 1)} label={`Progresso da meta ${g.name}`} size="sm" />
              <p className="num text-xs text-ink-3">
                {formatCurrency(g.currentAmount)} de {formatCurrency(g.targetAmount)}
                {g.monthlyContributionNeeded && <> · guarde <span className="font-medium text-ink">{formatCurrency(g.monthlyContributionNeeded)}/mês</span></>}
              </p>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function CompactRow({ t, onConfirm }: { t: Transaction; onConfirm?: () => void }) {
  const openEdit = useOpenTransaction();
  const overdue = paymentStatusKind(t) === "unpaid";
  const flow = t.type === "INCOME" ? "income" : t.type === "EXPENSE" ? "expense" : "neutral";
  return (
    <li className="flex items-center gap-3 py-3">
      {t.type === "TRANSFER" ? (
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-ink-2"><ArrowLeftRight className="size-4" /></span>
      ) : (
        <EntityIcon icon={t.category?.icon ?? "ellipsis"} color={t.category?.color ?? "#64748B"} size="sm" />
      )}
      <button type="button" onClick={() => openEdit(t)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-ink">{t.description}</span>
        <span className={cn("block text-xs", overdue ? "text-negative" : "text-ink-3")}>
          {overdue ? `Venceu ${dayLabel(t.date).toLowerCase()}` : dayLabel(t.date)}
          {t.installment && ` · ${t.installment.number}/${t.installment.total}`}
        </span>
      </button>
      <Amount value={t.amount} flow={flow} className={cn("text-sm font-medium", t.status === "PENDING" && "text-ink-2")} />
      {onConfirm && !isFuture(t.date) && (
        <IconButton label={t.type === "INCOME" ? "Marcar como recebido" : "Marcar como pago"} size="icon-sm" variant="secondary" onClick={onConfirm}>
          <Check />
        </IconButton>
      )}
    </li>
  );
}

export function UpcomingCard({ data }: { data: Dashboard }) {
  const toggle = useToggleCleared();
  const { commitments } = data;
  return (
    <Card>
      <CardHeader
        title="Próximos compromissos"
        description={`${formatCurrency(commitments.next30Days)} nos próximos 30 dias`}
        action={commitments.overdueCount > 0 ? <Badge tone="negative">{commitments.overdueCount} vencido{commitments.overdueCount > 1 ? "s" : ""}</Badge> : undefined}
      />
      <CardBody className="pt-1">
        {data.upcoming.length === 0 ? (
          <p className="py-6 text-sm text-ink-2">Nada pendente nas próximas duas semanas. Lançamentos agendados e recorrentes aparecem aqui.</p>
        ) : (
          <ul className="divide-y divide-line">{data.upcoming.map((t) => <CompactRow key={t.id} t={t} onConfirm={() => toggle.mutate(t)} />)}</ul>
        )}
      </CardBody>
    </Card>
  );
}

export function RecentCard({ data }: { data: Dashboard }) {
  const openNew = useComposer((s) => s.openNew);
  return (
    <Card>
      <CardHeader title="Últimos lançamentos" action={<Button variant="ghost" size="sm" asChild><Link href="/lancamentos">Ver todos</Link></Button>} />
      <CardBody className="pt-1">
        {data.recent.length === 0 ? (
          <div className="py-6">
            <p className="text-sm text-ink-2">Nenhum lançamento ainda.</p>
            <Button size="sm" className="mt-3" onClick={() => openNew("EXPENSE")}>Registrar o primeiro</Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">{data.recent.map((t) => <CompactRow key={t.id} t={t} />)}</ul>
        )}
      </CardBody>
    </Card>
  );
}
