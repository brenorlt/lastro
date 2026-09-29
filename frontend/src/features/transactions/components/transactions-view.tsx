"use client";

import { ArrowLeftRight, Plus, ReceiptText, SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/cn";
import { currentMonth, dayLabel, monthRange, type MonthRef } from "@/lib/dates";
import { toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { paymentStatusKind } from "@/features/transactions/components/payment-status";
import { useOpenTransaction } from "@/features/transactions/use-open-transaction";
import { useComposer } from "@/stores/composer-store";
import { useUiStore } from "@/stores/ui-store";
import type { Transaction, TransactionFilters, TransactionTotals } from "@/types/finance";
import { isSeries, useDeleteTransaction, useDuplicateTransaction, useToggleCleared, useTransactions } from "../api";
import { FiltersBar, MonthNavigator, type ListFilters } from "./filters-bar";
import { ScopeDialog } from "./scope-dialog";
import { TransactionRow } from "./transaction-row";

function Totals({ totals, hidden }: { totals: TransactionTotals; hidden: boolean }) {
  const net = toNumber(totals.net);
  const items = [
    { label: "Receitas", value: totals.income, pending: totals.pendingIncome, tone: "text-positive" },
    { label: "Despesas", value: totals.expense, pending: totals.pendingExpense, tone: "text-ink" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <Card key={i.label} className="p-4">
          <dt className="text-xs text-ink-3">{i.label}</dt>
          <dd><Amount value={i.value} hidden={hidden} className={cn("mt-1 block text-lg font-semibold", i.tone)} /></dd>
          {toNumber(i.pending) > 0 && (
            <dd className="mt-0.5 text-2xs text-ink-3">
              inclui <Amount value={i.pending} hidden={hidden} /> pendente
            </dd>
          )}
        </Card>
      ))}
      <Card className="col-span-2 p-4 sm:col-span-1">
        <dt className="text-xs text-ink-3">Resultado do período</dt>
        <dd>
          <Amount value={totals.net} hidden={hidden} className={cn("mt-1 block text-lg font-semibold", net < 0 ? "text-negative" : "text-ink")} />
        </dd>
        <dd className="mt-0.5 text-2xs text-ink-3">{net >= 0 ? "Você ganhou mais do que gastou" : "Você gastou mais do que ganhou"}</dd>
      </Card>
    </dl>
  );
}

function groupByDay(list: Transaction[]) {
  const groups: { date: string; items: Transaction[]; net: number }[] = [];
  for (const t of list) {
    let g = groups.at(-1);
    if (!g || g.date !== t.date) groups.push((g = { date: t.date, items: [], net: 0 }));
    g.items.push(t);
    g.net += t.type === "INCOME" ? toNumber(t.amount) : t.type === "EXPENSE" ? -toNumber(t.amount) : 0;
  }
  return groups;
}

export function TransactionsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openNew = useComposer((s) => s.openNew);
  const openEdit = useOpenTransaction();
  const hidden = useUiStore((s) => s.privacyMode);

  const [month, setMonth] = useState<MonthRef>(currentMonth);
  const [filters, setFilters] = useState<ListFilters>({ q: "" });
  const q = useDebouncedValue(filters.q.trim(), 300);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  // ?novo=despesa|receita|transferencia (atalhos da busca global) abre o compositor.
  useEffect(() => {
    const novo = params.get("novo");
    if (!novo) return;
    openNew(novo === "receita" ? "INCOME" : novo === "transferencia" ? "TRANSFER" : "EXPENSE");
    router.replace(pathname);
  }, [params, openNew, router, pathname]);

  const query: TransactionFilters = useMemo(
    () => ({
      ...monthRange(month),
      q: q || undefined,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      status: filters.situation === "CLEARED" ? "CLEARED" : filters.situation ? "PENDING" : undefined,
    }),
    [month, q, filters.type, filters.accountId, filters.categoryId, filters.situation],
  );
  const list = useTransactions(query);
  const toggle = useToggleCleared();
  const duplicate = useDuplicateTransaction();
  const del = useDeleteTransaction();

  // Agendado/Não pago são inferidos pela data (não existem como status na API): PENDING é buscado
  // inteiro e refinado aqui, então a contagem exibida usa a lista já filtrada, não o total da página.
  const allRows = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  const rows = useMemo(() => {
    if (filters.situation !== "SCHEDULED" && filters.situation !== "UNPAID") return allRows;
    const kind = filters.situation === "SCHEDULED" ? "scheduled" : "unpaid";
    return allRows.filter((t) => paymentStatusKind(t) === kind);
  }, [allRows, filters.situation]);
  const meta = list.data?.pages[0]?.meta;
  const narrowed = filters.situation === "SCHEDULED" || filters.situation === "UNPAID";
  const count = narrowed ? rows.length : meta?.total;
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const filtered = Boolean(q || filters.type || filters.accountId || filters.categoryId || filters.situation);

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Receitas, despesas e transferências. Pendentes não alteram o saldo até serem confirmados."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Lançamentos" }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => openNew("TRANSFER")}><ArrowLeftRight aria-hidden /> Transferir</Button>
            <Button onClick={() => openNew("EXPENSE")}><Plus aria-hidden /> Novo lançamento</Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <MonthNavigator value={month} onChange={setMonth} />
        {count !== undefined && <p className="num text-xs text-ink-3">{count} {count === 1 ? "lançamento" : "lançamentos"}</p>}
      </div>

      {meta ? <Totals totals={meta.totals} hidden={hidden} /> : list.isPending && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => <Card key={i} className={cn("space-y-2 p-4", i === 2 && "col-span-2 sm:col-span-1")}><Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-28" /></Card>)}
        </div>
      )}

      <div className="my-6">
        <FiltersBar value={filters} onChange={setFilters} />
      </div>

      {list.isPending ? (
        <Card className="divide-y divide-line" aria-busy="true" aria-label="Carregando lançamentos">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <Skeleton className="size-10 rounded-md" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </Card>
      ) : list.isError ? (
        <Card><ErrorState description={userMessage(list.error)} onRetry={() => void list.refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState compact icon={SearchX} title="Nada encontrado com esses filtros" description="Tente outro termo, outro período ou limpe os filtros." action={<Button variant="secondary" onClick={() => setFilters({ q: "" })}>Limpar filtros</Button>} />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="Nenhum lançamento neste mês"
              description="Registre receitas e despesas para ver para onde vai seu dinheiro. Lançamentos recorrentes e parcelados aparecem aqui automaticamente."
              action={<Button onClick={() => openNew("EXPENSE")}><Plus aria-hidden /> Novo lançamento</Button>}
              secondaryAction={<Button variant="ghost" onClick={() => openNew("INCOME")}>Registrar receita</Button>}
            />
          )}
        </Card>
      ) : (
        <div className={cn("space-y-5 transition-opacity", list.isFetching && !list.isFetchingNextPage && "opacity-70")}>
          {groups.map((g) => (
            <section key={g.date} aria-labelledby={`day-${g.date}`}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 id={`day-${g.date}`} className="text-xs font-medium text-ink-2">{dayLabel(g.date)}</h3>
                <Amount value={Math.abs(g.net)} flow={g.net > 0 ? "income" : g.net < 0 ? "expense" : "neutral"} hidden={hidden} className="text-xs text-ink-3" />
              </div>
              <Card className="divide-y divide-line overflow-hidden">
                {g.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    hidden={hidden}
                    onEdit={() => openEdit(t)}
                    onToggle={() => toggle.mutate(t)}
                    onDuplicate={() => duplicate.mutate(t.id)}
                    onDelete={() => setDeleting(t)}
                  />
                ))}
              </Card>
            </section>
          ))}
          {list.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {deleting && isSeries(deleting) ? (
        <ScopeDialog
          transaction={deleting}
          action="delete"
          loading={del.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={(scope) => del.mutate({ id: deleting.id, scope }, { onSettled: () => setDeleting(null) })}
        />
      ) : (
        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(v) => !v && setDeleting(null)}
          title={`Excluir “${deleting?.description ?? ""}”?`}
          description={deleting?.status === "CLEARED" ? "O saldo da conta será ajustado. Esta ação não pode ser desfeita." : "Esta ação não pode ser desfeita."}
          confirmLabel="Excluir lançamento"
          loading={del.isPending}
          onConfirm={() => deleting && del.mutate({ id: deleting.id, scope: "single" }, { onSettled: () => setDeleting(null) })}
        />
      )}
    </>
  );
}
