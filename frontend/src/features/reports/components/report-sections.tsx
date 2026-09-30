"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { BarChart, LineChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { Amount } from "@/components/finance/amount";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shortMonth } from "@/features/dashboard/api";
import { LEVEL_COPY } from "@/features/budgets/api";
import { goalCategoryLabel } from "@/features/goals/api";
import { investmentTypeLabel, CLASS_COLORS } from "@/features/investments/api";
import { PaymentStatusBadge } from "@/features/transactions/components/payment-status";
import { monthYear } from "@/features/goals/model";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { ReportFilters } from "@/types/reports";
import {
  useBudgetReport,
  useCashFlowReport,
  useCategoriesReport,
  useGoalsReport,
  useInvestmentsReport,
  useNetWorthReport,
  useTransactionsReport,
} from "../api";
import { monthsBetween } from "../period";
import { BarChart3 } from "lucide-react";

function Loading() {
  return <div className="space-y-4" aria-busy="true" aria-label="Gerando relatório"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
}

function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return <Card><ErrorState description={userMessage(error)} onRetry={retry} /></Card>;
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn("num mt-1 text-lg font-semibold text-ink", tone)}>{value}</dd>
    </Card>
  );
}

function Empty() {
  return <Card><EmptyState compact icon={BarChart3} title="Sem dados neste período" description="Ajuste o período ou os filtros. Relatórios usam seus lançamentos, contas e investimentos registrados." /></Card>;
}

export function CashFlowSection({ filters }: { filters: ReportFilters }) {
  const span = monthsBetween(filters.from, filters.to);
  const [granularity, setGranularity] = useState<"day" | "week" | "month">(span <= 1 ? "day" : span <= 3 ? "week" : "month");
  const q = useCashFlowReport(filters, granularity, true);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <Failed error={q.error} retry={() => void q.refetch()} />;
  const { rows, totals } = q.data;
  if (rows.every((r) => toNumber(r.income) === 0 && toNumber(r.expense) === 0)) return <Empty />;
  const chart = rows.map((r) => ({ label: r.label, receitas: toNumber(r.income), despesas: toNumber(r.expense) }));

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receitas" value={formatCurrency(totals.income)} tone="text-positive" />
        <Stat label="Despesas" value={formatCurrency(totals.expense)} />
        <Stat label="Resultado" value={formatCurrency(totals.net)} tone={toNumber(totals.net) < 0 ? "text-negative" : undefined} />
        <Stat label="Taxa de poupança" value={totals.savingsRate === null ? "—" : formatPercent(totals.savingsRate)} />
      </dl>
      <ChartCard
        title="Fluxo de caixa"
        takeaway={`Média de ${formatCurrency(totals.averageMonthlyIncome)} de receitas e ${formatCurrency(totals.averageMonthlyExpense)} de despesas por mês.`}
        legend={[{ label: "Receitas", color: "var(--positive)" }, { label: "Despesas", color: "var(--ink-3)" }]}
        action={
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as typeof granularity)}>
            <TabsList aria-label="Agrupar por">
              {span <= 3 && <TabsTrigger value="day">Dia</TabsTrigger>}
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <BarChart data={chart} xKey="label" series={[{ key: "receitas", label: "Receitas", color: "var(--positive)" }, { key: "despesas", label: "Despesas", color: "var(--ink-3)" }]} ariaLabel="Receitas e despesas no período" height={260} />
      </ChartCard>
      <Card className="overflow-hidden">
        <Table>
          <THead><TR className="hover:bg-transparent"><TH>Período</TH><TH align="right">Receitas</TH><TH align="right">Despesas</TH><TH align="right">Resultado</TH><TH align="right">Acumulado</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.period}>
                <TD className="h-11">{r.label}</TD>
                <TD align="right" className="h-11 text-positive">{formatCurrency(r.income)}</TD>
                <TD align="right" className="h-11">{formatCurrency(r.expense)}</TD>
                <TD align="right" className={cn("h-11 font-medium", toNumber(r.net) < 0 && "text-negative")}>{formatCurrency(r.net)}</TD>
                <TD align="right" className="h-11 text-ink-2">{formatCurrency(r.cumulative)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function CategoryRowView({ r, total, nested }: { r: import("@/types/reports").CategoryRow; total: number; nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const has = (r.children?.length ?? 0) > 0;
  return (
    <li>
      <div className={cn("flex items-center gap-3 py-3", nested ? "pl-10 pr-5 sm:pr-6" : "px-5 sm:px-6")}>
        {has ? (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${open ? "Recolher" : "Expandir"} ${r.name}`} className="-ml-1 flex size-6 items-center justify-center rounded-xs text-ink-3 hover:text-ink">
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden />
          </button>
        ) : !nested && <span className="w-5" />}
        <EntityIcon icon={r.icon} color={r.color} size="sm" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-ink">{r.name}</span>
            <span className="num shrink-0 text-sm font-medium text-ink">{formatCurrency(r.amount)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={toNumber(r.amount)} max={Math.max(total, 1)} size="sm" label={`${r.name}: ${formatPercent(r.share, { fractionDigits: 0 })}`} className="flex-1" />
            <span className="num w-10 text-right text-xs text-ink-3">{Math.round(r.share)}%</span>
            <span className={cn("num w-16 text-right text-xs", r.change === null ? "text-ink-3" : r.change > 0 ? "text-warning" : "text-positive")}>
              {r.change === null ? "novo" : formatPercent(r.change, { signed: true, fractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
      {open && has && <ul className="divide-y divide-line bg-surface-sunken/40">{r.children!.map((c, i) => <CategoryRowView key={c.categoryId ?? `sem-categoria-${i}`} r={c} total={total} nested />)}</ul>}
    </li>
  );
}

export function CategoriesSection({ filters }: { filters: ReportFilters }) {
  const [type, setType] = useState<"EXPENSE" | "INCOME">(filters.type ?? "EXPENSE");
  const q = useCategoriesReport(filters, type, true);
  return (
    <div className="space-y-4">
      <Tabs value={type} onValueChange={(v) => setType(v as "EXPENSE" | "INCOME")}>
        <TabsList aria-label="Tipo"><TabsTrigger value="EXPENSE">Despesas</TabsTrigger><TabsTrigger value="INCOME">Receitas</TabsTrigger></TabsList>
      </Tabs>
      {q.isPending ? <Loading /> : q.isError || !q.data ? <Failed error={q.error} retry={() => void q.refetch()} /> : q.data.rows.length === 0 ? <Empty /> : (
        <Card>
          <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6">
            <p className="text-sm font-medium text-ink">{type === "EXPENSE" ? "Despesas" : "Receitas"} por categoria</p>
            <p className="num text-sm font-semibold text-ink">{formatCurrency(q.data.total)}</p>
          </div>
          <p className="px-5 pb-2 text-xs text-ink-3 sm:px-6">Variação comparada ao período anterior de mesma duração.</p>
          <ul className="divide-y divide-line">{q.data.rows.map((r, i) => <CategoryRowView key={r.categoryId ?? `sem-categoria-${i}`} r={r} total={toNumber(q.data.total)} />)}</ul>
        </Card>
      )}
    </div>
  );
}

export function TransactionsSection({ filters }: { filters: ReportFilters }) {
  const [page, setPage] = useState(1);
  const q = useTransactionsReport(filters, page, true);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <Failed error={q.error} retry={() => void q.refetch()} />;
  const { data, meta } = q.data;
  if (data.length === 0) return <Empty />;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 sm:px-6">
        <p className="num text-sm text-ink-2">{meta?.total} lançamentos</p>
        {meta && <p className="num text-xs text-ink-3">Receitas {formatCurrency(meta.totals.income)} · Despesas {formatCurrency(meta.totals.expense)} · Resultado {formatCurrency(meta.totals.net)}</p>}
      </div>
      <Table>
        <THead><TR className="hover:bg-transparent"><TH>Data</TH><TH>Descrição</TH><TH>Categoria</TH><TH>Conta / cartão</TH><TH align="right">Valor</TH></TR></THead>
        <TBody>
          {data.map((t) => (
            <TR key={t.id}>
              <TD className="h-11 whitespace-nowrap text-ink-2">{dayLabel(t.date)}</TD>
              <TD className="h-11">{t.description}{!t.creditCard && <PaymentStatusBadge transaction={t} className="ml-2" />}</TD>
              <TD className="h-11 text-ink-2">{t.category?.name ?? (t.type === "TRANSFER" ? "Transferência" : "—")}</TD>
              <TD className="h-11 text-ink-2">{t.account?.name ?? t.creditCard?.name ?? t.transferAccount?.name}</TD>
              <TD align="right" className="h-11"><Amount value={t.amount} flow={t.type === "INCOME" ? "income" : t.type === "EXPENSE" ? "expense" : "neutral"} /></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="font-medium text-accent disabled:text-ink-3">Anterior</button>
          <span className="num">Página {page} de {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="font-medium text-accent disabled:text-ink-3">Próxima</button>
        </div>
      )}
    </Card>
  );
}

export function NetWorthSection({ months }: { months: number }) {
  const q = useNetWorthReport(months, true);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <Failed error={q.error} retry={() => void q.refetch()} />;
  const rows = q.data.rows;
  return (
    <div className="space-y-4">
      <ChartCard title="Evolução patrimonial" legend={[{ label: "Patrimônio líquido", color: "var(--brass)" }, { label: "Ativos", color: "var(--series-1)" }, { label: "Passivos", color: "var(--series-2)" }]}>
        <LineChart
          data={rows.map((r) => ({ m: shortMonth(r.month), liquido: toNumber(r.netWorth), ativos: toNumber(r.assets), passivos: toNumber(r.liabilities) }))}
          xKey="m"
          domain={["auto", "auto"]}
          series={[{ key: "liquido", label: "Patrimônio líquido", color: "var(--brass)" }, { key: "ativos", label: "Ativos", color: "var(--series-1)" }, { key: "passivos", label: "Passivos", color: "var(--series-2)" }]}
          ariaLabel="Evolução de ativos, passivos e patrimônio"
          height={260}
        />
      </ChartCard>
      <Card className="overflow-hidden">
        <Table>
          <THead><TR className="hover:bg-transparent"><TH>Mês</TH><TH align="right">Ativos</TH><TH align="right">Passivos</TH><TH align="right">Patrimônio líquido</TH></TR></THead>
          <TBody>{rows.map((r) => <TR key={r.month}><TD className="h-11">{monthYear(`${r.month}-01`)}</TD><TD align="right" className="h-11">{formatCurrency(r.assets)}</TD><TD align="right" className="h-11">{formatCurrency(r.liabilities)}</TD><TD align="right" className="h-11 font-medium">{formatCurrency(r.netWorth)}</TD></TR>)}</TBody>
        </Table>
      </Card>
    </div>
  );
}

export function InvestmentsSection() {
  const q = useInvestmentsReport(true);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <Failed error={q.error} retry={() => void q.refetch()} />;
  const d = q.data;
  if (d.positions.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Valor atual" value={formatCurrency(d.totals.totalCurrent)} />
        <Stat label="Aplicado" value={formatCurrency(d.totals.totalInvested)} />
        <Stat label="Rentabilidade" value={formatCurrency(d.totals.profit)} tone={toNumber(d.totals.profit) < 0 ? "text-negative" : "text-positive"} />
        <Stat label="Rentabilidade %" value={d.totals.profitPercent === null ? "—" : formatPercent(d.totals.profitPercent, { signed: true })} />
      </dl>
      {d.contributionsByMonth.some((c) => toNumber(c.amount) !== 0) && (
        <ChartCard title="Aportes por mês" takeaway="Compras menos resgates em cada mês.">
          <BarChart data={d.contributionsByMonth.map((c) => ({ m: shortMonth(c.month), aportes: toNumber(c.amount) }))} xKey="m" series={[{ key: "aportes", label: "Aportes", color: "var(--series-1)" }]} ariaLabel="Aportes líquidos por mês" height={200} />
        </ChartCard>
      )}
      <Card className="overflow-hidden">
        <Table>
          <THead><TR className="hover:bg-transparent"><TH>Ativo</TH><TH>Classe</TH><TH align="right">Aplicado</TH><TH align="right">Atual</TH><TH align="right">Rentab.</TH><TH align="right">Carteira</TH></TR></THead>
          <TBody>
            {d.positions.map((p) => (
              <TR key={p.id}>
                <TD className="h-11"><span className="flex items-center gap-2"><span aria-hidden className="size-2 rounded-full" style={{ background: CLASS_COLORS[p.type] }} />{p.name}{p.ticker && <span className="text-xs text-ink-3">{p.ticker}</span>}</span></TD>
                <TD className="h-11 text-ink-2">{investmentTypeLabel(p.type)}</TD>
                <TD align="right" className="h-11">{formatCurrency(p.investedAmount)}</TD>
                <TD align="right" className="h-11 font-medium">{formatCurrency(p.currentValue)}</TD>
                <TD align="right" className={cn("h-11", toNumber(p.profit) < 0 ? "text-negative" : "text-positive")}>{p.profitPercent === null ? "—" : formatPercent(p.profitPercent, { signed: true })}</TD>
                <TD align="right" className="h-11 text-ink-2">{formatPercent(p.allocationPercent, { fractionDigits: 0 })}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <p className="text-xs text-ink-3">Valores de mercado conforme informados por você. Não constituem recomendação de investimento.</p>
    </div>
  );
}

export function GoalsSection() {
  const q = useGoalsReport(true);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <Failed error={q.error} retry={() => void q.refetch()} />;
  if (q.data.rows.length === 0) return <Empty />;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between px-5 py-4 sm:px-6">
        <p className="text-sm font-medium text-ink">Metas</p>
        <p className="num text-sm text-ink-2">{formatCurrency(q.data.totals.saved)} de {formatCurrency(q.data.totals.target)}</p>
      </div>
      <Table>
        <THead><TR className="hover:bg-transparent"><TH>Meta</TH><TH>Tipo</TH><TH>Progresso</TH><TH align="right">Guardado</TH><TH align="right">Objetivo</TH><TH>Prazo</TH><TH align="right">Necessário/mês</TH></TR></THead>
        <TBody>
          {q.data.rows.map((g) => (
            <TR key={g.id}>
              <TD className="h-12 font-medium">{g.name}</TD>
              <TD className="h-12 text-ink-2">{goalCategoryLabel(g.category)}</TD>
              <TD className="h-12 w-40"><div className="flex items-center gap-2"><Progress value={g.progress} size="sm" tone={g.status === "COMPLETED" ? "positive" : "accent"} label={`Progresso de ${g.name}`} /><span className="num w-10 text-right text-xs text-ink-3">{Math.round(g.progress)}%</span></div></TD>
              <TD align="right" className="h-12">{formatCurrency(g.currentAmount)}</TD>
              <TD align="right" className="h-12">{formatCurrency(g.targetAmount)}</TD>
              <TD className="h-12 text-ink-2">{g.targetDate ? monthYear(g.targetDate) : "—"}</TD>
              <TD align="right" className="h-12">{g.requiredMonthly ? formatCurrency(g.requiredMonthly) : "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

export function BudgetSection({ fromMonth, toMonth }: { fromMonth: string; toMonth: string }) {
  const q = useBudgetReport(fromMonth, toMonth, true);
  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) return <Failed error={q.error} retry={() => void q.refetch()} />;
  const months = q.data.months.filter((m) => m.items.length > 0);
  if (months.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      {months.map((m) => (
        <Card key={m.month} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <p className="text-sm font-medium text-ink">{monthYear(`${m.month}-01`)}</p>
            <p className="num text-xs text-ink-2">{formatCurrency(m.totalSpent)} de {formatCurrency(m.totalLimit)} · {formatPercent(m.percent, { fractionDigits: 0 })}</p>
          </div>
          <Table>
            <THead><TR className="hover:bg-transparent"><TH>Categoria</TH><TH align="right">Limite</TH><TH align="right">Gasto</TH><TH align="right">Uso</TH><TH>Situação</TH></TR></THead>
            <TBody>
              {m.items.map((i) => (
                <TR key={i.category.id}>
                  <TD className="h-11"><span className="flex items-center gap-2"><EntityIcon icon={i.category.icon} color={i.category.color} className="size-6 rounded-[6px] [&_svg]:size-3.5" />{i.category.name}</span></TD>
                  <TD align="right" className="h-11">{formatCurrency(i.limitAmount)}</TD>
                  <TD align="right" className="h-11">{formatCurrency(i.spent)}</TD>
                  <TD align="right" className="h-11">{formatPercent(i.percent, { fractionDigits: 0 })}</TD>
                  <TD className="h-11"><Badge tone={LEVEL_COPY[i.level].tone}>{i.level === "OK" ? "No controle" : LEVEL_COPY[i.level].label}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
