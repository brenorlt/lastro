"use client";

import { Landmark, MoreHorizontal, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DonutChart, LineChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { shortMonth } from "@/features/dashboard/api";
import { cn } from "@/lib/cn";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import type { Investment } from "@/types/wealth";
import { CLASS_COLORS, investmentTypeLabel, useDeleteInvestment, useInvestments, useInvestmentSeries } from "../api";
import { InvestmentDetailDrawer } from "./investment-detail";
import { InvestmentFormDrawer } from "./investment-form";

function Profit({ value, percent, hidden }: { value: string; percent: number | null; hidden: boolean }) {
  const n = toNumber(value);
  return (
    <span className={cn("num text-sm font-medium", n >= 0 ? "text-positive" : "text-negative")}>
      {hidden ? "••••" : `${n >= 0 ? "+" : "−"}${formatCurrency(Math.abs(n))}`}
      {percent !== null && <span className="ml-1 text-xs">({formatPercent(percent, { signed: true })})</span>}
    </span>
  );
}

export function InvestmentsView() {
  const hidden = useUiStore((s) => s.privacyMode);
  const q = useInvestments();
  const series = useInvestmentSeries();
  const del = useDeleteInvestment();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Investment | null>(null);
  const list = q.data?.data ?? [];
  const meta = q.data?.meta;
  const unallocated = meta ? toNumber(meta.unallocatedBrokerCash) : 0;

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  return (
    <>
      <PageHeader
        title="Investimentos"
        description="Sua carteira por classe, rentabilidade e aportes. Os valores são os que você registra — atualize periodicamente."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Investimentos" }]}
        actions={<Button onClick={openCreate}><Plus aria-hidden /> Novo investimento</Button>}
      />

      {q.isPending ? (
        <div className="space-y-4" aria-busy="true"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : q.isError || !meta ? (
        <Card><ErrorState description={userMessage(q.error)} onRetry={() => void q.refetch()} /></Card>
      ) : list.length === 0 && unallocated === 0 ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Comece sua carteira"
            description="Cadastre CDBs, Tesouro, ações, FIIs, fundos, previdência ou cripto. Você vê a distribuição por classe, a rentabilidade e a evolução dos aportes."
            action={<Button onClick={openCreate}><Plus aria-hidden /> Novo investimento</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4"><dt className="text-xs text-ink-3">Patrimônio investido</dt><dd><Amount value={toNumber(meta.totalCurrent) + unallocated} hidden={hidden} className="mt-1 block text-xl font-semibold tracking-tight" /></dd></Card>
            <Card className="p-4"><dt className="text-xs text-ink-3">Valor aplicado</dt><dd><Amount value={meta.totalInvested} hidden={hidden} className="mt-1 block text-xl font-semibold tracking-tight" /></dd></Card>
            <Card className="p-4"><dt className="text-xs text-ink-3">Rentabilidade</dt><dd className="mt-1"><Profit value={meta.profit} percent={meta.profitPercent} hidden={hidden} /></dd></Card>
            <Card className="p-4"><dt className="text-xs text-ink-3">Proventos líquidos</dt><dd><Amount value={meta.totalIncome} hidden={hidden} className="mt-1 block text-xl font-semibold tracking-tight" /></dd></Card>
          </dl>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Evolução da carteira"
              takeaway="Valor de mercado registrado × quanto você aplicou."
              legend={[{ label: "Valor", color: "var(--series-1)" }, { label: "Aplicado", color: "var(--ink-3)", dashed: true }]}
            >
              {series.data && series.data.some((p) => toNumber(p.value) > 0) ? (
                <LineChart
                  data={series.data.map((p) => ({ month: shortMonth(p.month), valor: toNumber(p.value), aplicado: toNumber(p.invested) }))}
                  xKey="month"
                  domain={["auto", "auto"]}
                  series={[{ key: "valor", label: "Valor", color: "var(--series-1)" }, { key: "aplicado", label: "Aplicado", color: "var(--ink-3)", dashed: true }]}
                  ariaLabel="Valor e valor aplicado da carteira nos últimos 12 meses"
                  height={240}
                />
              ) : <p className="px-3 py-16 text-center text-sm text-ink-3">A evolução aparece conforme você registra aportes e atualizações.</p>}
            </ChartCard>
            <ChartCard title="Distribuição por classe" takeaway={meta.byClass[0] ? `${investmentTypeLabel(meta.byClass[0].type)} é ${Math.round(meta.byClass[0].share)}% da carteira.` : undefined}>
              {meta.byClass.length > 0 ? (
                <>
                  <DonutChart data={meta.byClass.map((c) => ({ id: c.type, label: investmentTypeLabel(c.type), value: toNumber(c.current) }))} colors={meta.byClass.map((c) => CLASS_COLORS[c.type])} ariaLabel="Carteira por classe de ativo" size={170} />
                  <ul className="mt-5 space-y-2 px-3">
                    {meta.byClass.map((c) => (
                      <li key={c.type} className="flex items-center gap-2 text-xs">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: CLASS_COLORS[c.type] }} />
                        <span className="truncate text-ink-2">{investmentTypeLabel(c.type)}</span>
                        <span className="num ml-auto font-medium text-ink">{hidden ? "••••" : formatCurrency(c.current)}</span>
                        <span className="num w-9 text-right text-ink-3">{Math.round(c.share)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="px-3 py-12 text-center text-sm text-ink-3">Cadastre ativos para ver a distribuição.</p>}
            </ChartCard>
          </div>

          <Card className="overflow-hidden">
            <div className="hidden md:block">
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Ativo</TH><TH>Classe</TH><TH align="right">Aplicado</TH><TH align="right">Valor atual</TH><TH align="right">Rentabilidade</TH><TH align="right">Carteira</TH><TH><span className="sr-only">Ações</span></TH></TR></THead>
                <TBody>
                  {list.map((i) => (
                    <TR key={i.id} className="cursor-pointer" onClick={() => setOpenId(i.id)}>
                      <TD><button type="button" className="text-left font-medium" onClick={() => setOpenId(i.id)}>{i.name}</button><span className="block text-xs text-ink-3">{[i.ticker, i.institution].filter(Boolean).join(" · ")}</span></TD>
                      <TD className="text-ink-2">{investmentTypeLabel(i.type)}</TD>
                      <TD align="right">{hidden ? "••••" : formatCurrency(i.investedAmount)}</TD>
                      <TD align="right" className="font-medium">{hidden ? "••••" : formatCurrency(i.currentValue)}</TD>
                      <TD align="right"><Profit value={i.profit} percent={i.profitPercent} hidden={hidden} /></TD>
                      <TD align="right" className="text-ink-2">{formatPercent(i.allocationPercent, { fractionDigits: 0 })}</TD>
                      <TD align="right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><IconButton label={`Ações de ${i.name}`} size="icon-sm"><MoreHorizontal /></IconButton></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => { setEditing(i); setFormOpen(true); }}><Pencil aria-hidden /> Editar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => setDeleting(i)}><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {list.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setOpenId(i.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: CLASS_COLORS[i.type] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{i.name}</span>
                      <span className="block text-xs text-ink-3">{investmentTypeLabel(i.type)}</span>
                    </span>
                    <span className="text-right">
                      <Amount value={i.currentValue} hidden={hidden} className="block text-sm font-semibold" />
                      <Profit value={i.profit} percent={i.profitPercent} hidden={hidden} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {unallocated > 0 && (
              <div className="flex items-center gap-3 border-t border-line bg-surface-sunken/50 px-5 py-3.5 text-sm">
                <Landmark className="size-4 text-ink-3" aria-hidden />
                <span className="flex-1 text-ink-2">Saldo em contas de investimento, ainda não detalhado por ativo</span>
                <Amount value={unallocated} hidden={hidden} className="font-medium" />
                <Link href="/contas" className="text-xs font-medium text-accent hover:underline">Ver contas</Link>
              </div>
            )}
          </Card>
        </div>
      )}

      {formOpen && <InvestmentFormDrawer key={editing?.id ?? "new"} open onOpenChange={setFormOpen} investment={editing} />}
      <InvestmentDetailDrawer id={openId} onOpenChange={(v) => !v && setOpenId(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description="O ativo sai da carteira e do patrimônio. Movimentações de conta já registradas continuam no seu histórico."
        confirmLabel="Excluir investimento"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
      />
    </>
  );
}
