"use client";

import { Copy, Gauge, Lightbulb, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { MonthNavigator } from "@/features/transactions/components/filters-bar";
import { cn } from "@/lib/cn";
import { currentMonth, shiftMonth, type MonthRef } from "@/lib/dates";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import type { Budget, BudgetLevel } from "@/types/planning";
import { LEVEL_COPY, useBudgets, useBudgetSuggestions, useCopyBudgets, useDeleteBudget } from "../api";
import { CreateBudgetDialog, EditLimitDialog } from "./budget-dialogs";

const ym = ({ year, month }: MonthRef) => `${year}-${String(month + 1).padStart(2, "0")}`;
const toneOf = (l: BudgetLevel) => (l === "EXCEEDED" ? "negative" : l === "WARNING" ? "warning" : "accent");
/** Sugestão arredondada para cima em múltiplos de 50 — limites redondos são mais fáceis de lembrar. */
const roundUp50 = (v: string) => String(Math.max(50, Math.ceil(toNumber(v) / 50) * 50));

function BudgetRow({ b, hidden, onEdit, onDelete }: { b: Budget; hidden: boolean; onEdit: () => void; onDelete: () => void }) {
  const over = toNumber(b.remaining) < 0;
  const copy = LEVEL_COPY[b.level];
  return (
    <li className="space-y-3 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <EntityIcon icon={b.category.icon} color={b.category.color} size="sm" />
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-ink">{b.category.name}</span>
          <span className="num block text-xs text-ink-3">
            {hidden ? "••••" : formatCurrency(b.spent)} de {hidden ? "••••" : formatCurrency(b.limitAmount)}
          </span>
        </button>
        {b.level !== "OK" && <Badge tone={copy.tone}>{copy.label}</Badge>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton label={`Ações de ${b.category.name}`} size="icon-sm"><MoreHorizontal /></IconButton></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Alterar limite</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}><Trash2 aria-hidden /> Remover orçamento</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Progress value={b.percent} tone={toneOf(b.level)} markers={[50, 80]} label={`Orçamento de ${b.category.name}: ${formatPercent(b.percent, { fractionDigits: 0 })} usado`} />
      <p className={cn("num text-xs", over ? "text-negative" : b.level === "WARNING" ? "text-warning" : "text-ink-3")}>
        {over
          ? `Excedido em ${hidden ? "••••" : formatCurrency(Math.abs(toNumber(b.remaining)))} · ${formatPercent(b.percent, { fractionDigits: 0 })}`
          : `Disponível: ${hidden ? "••••" : formatCurrency(b.remaining)} · ${formatPercent(b.percent, { fractionDigits: 0 })} usado`}
      </p>
    </li>
  );
}

export function BudgetsView() {
  const hidden = useUiStore((s) => s.privacyMode);
  const [month, setMonth] = useState<MonthRef>(currentMonth);
  const m = ym(month);
  const query = useBudgets(m);
  const suggestions = useBudgetSuggestions(m);
  const copy = useCopyBudgets();
  const del = useDeleteBudget();
  const [creating, setCreating] = useState<{ categoryId: string; limit: string } | null | false>(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  const budgets = query.data?.data ?? [];
  const meta = query.data?.meta;
  const suggestionList = useMemo(() => suggestions.data ?? [], [suggestions.data]);
  const alerts = budgets.filter((b) => b.level === "WARNING" || b.level === "EXCEEDED").length;

  return (
    <>
      <PageHeader
        title="Orçamento"
        description="Limites mensais por categoria. Avisamos quando você chega a 50%, 80% e 100% de cada um."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Orçamento" }]}
        actions={
          <>
            <Button variant="secondary" loading={copy.isPending} onClick={() => copy.mutate({ from: ym(shiftMonth(month, -1)), to: m })}>
              <Copy aria-hidden /> Copiar mês anterior
            </Button>
            <Button onClick={() => setCreating(null)}><Plus aria-hidden /> Novo orçamento</Button>
          </>
        }
      />

      <div className="mb-6"><MonthNavigator value={month} onChange={setMonth} /></div>

      {query.isPending ? (
        <Card className="space-y-4 p-6" aria-busy="true" aria-label="Carregando orçamentos">
          <Skeleton className="h-6 w-48" /><Skeleton className="h-2 w-full" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </Card>
      ) : query.isError ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="space-y-4">
            {meta && budgets.length > 0 && (
              <Card className="p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-ink-3">Gasto no mês</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                      <Amount value={meta.totalSpent} hidden={hidden} />{" "}
                      <span className="text-base font-normal text-ink-3">de <Amount value={meta.totalLimit} hidden={hidden} /></span>
                    </p>
                  </div>
                  {alerts > 0 && <Badge tone="warning">{alerts} {alerts === 1 ? "categoria pede" : "categorias pedem"} atenção</Badge>}
                </div>
                <Progress className="mt-4" value={meta.percent} tone={meta.percent >= 100 ? "negative" : meta.percent >= 80 ? "warning" : "accent"} label="Orçamento total usado" />
                <p className="num mt-2 text-xs text-ink-3">
                  {toNumber(meta.remaining) >= 0 ? `Ainda cabem ${hidden ? "••••" : formatCurrency(meta.remaining)} neste mês` : `Acima do planejado em ${hidden ? "••••" : formatCurrency(Math.abs(toNumber(meta.remaining)))}`}
                  {toNumber(meta.unbudgetedSpent) > 0 && ` · ${hidden ? "••••" : formatCurrency(meta.unbudgetedSpent)} gastos fora do orçamento`}
                </p>
              </Card>
            )}

            <Card>
              {budgets.length === 0 ? (
                <EmptyState
                  icon={Gauge}
                  title="Nenhum orçamento neste mês"
                  description="Escolha as categorias que mais pesam e defina um limite. É a forma mais simples de gastar com intenção."
                  action={<Button onClick={() => setCreating(null)}><Plus aria-hidden /> Criar orçamento</Button>}
                  secondaryAction={<Button variant="ghost" onClick={() => copy.mutate({ from: ym(shiftMonth(month, -1)), to: m })}>Copiar do mês anterior</Button>}
                />
              ) : (
                <ul className="divide-y divide-line">
                  {budgets.map((b) => <BudgetRow key={b.id} b={b} hidden={hidden} onEdit={() => setEditing(b)} onDelete={() => setDeleting(b)} />)}
                </ul>
              )}
            </Card>
          </div>

          {suggestionList.length > 0 && (
            <Card>
              <CardHeader title="Sugestões" description="Categorias com gastos recentes e sem limite neste mês" action={<Lightbulb className="size-4 text-ink-3" aria-hidden />} />
              <ul className="divide-y divide-line px-5 pb-2 pt-2 sm:px-6">
                {suggestionList.slice(0, 5).map((s) => (
                  <li key={s.category.id} className="flex items-center gap-3 py-3">
                    <EntityIcon icon={s.category.icon} color={s.category.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{s.category.name}</p>
                      <p className="num text-xs text-ink-3">média {formatCurrency(s.averageSpent)}/mês</p>
                    </div>
                    <Button size="sm" variant="subtle" onClick={() => setCreating({ categoryId: s.category.id, limit: roundUp50(s.averageSpent) })}>
                      Definir
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {creating !== false && (
        <CreateBudgetDialog open onOpenChange={(v) => !v && setCreating(false)} month={m} suggestions={suggestionList} preset={creating} />
      )}
      {editing && <EditLimitDialog key={editing.id} budget={editing} onOpenChange={(v) => !v && setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remover orçamento de ${deleting?.category.name ?? ""}?`}
        description="Seus lançamentos não são afetados — só o limite deste mês deixa de existir."
        confirmLabel="Remover orçamento"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
      />
    </>
  );
}
