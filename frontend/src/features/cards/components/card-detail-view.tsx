"use client";

import { Archive, ArchiveRestore, ArrowLeftRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Badge, Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { shortMonth } from "@/features/dashboard/api";
import { monthYear } from "@/features/goals/model";
import { cn } from "@/lib/cn";
import { dayLabel, todayISO } from "@/lib/dates";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { ApiError, userMessage } from "@/services/api-error";
import { useComposer } from "@/stores/composer-store";
import { useUiStore } from "@/stores/ui-store";
import type { InvoiceSummary } from "@/types/cards";
import { INVOICE_STATUS, useCard, useCardSpending, useDeleteCard, useInvoice, useInvoices, useToggleCardArchive } from "../api";
import { CardFormDrawer } from "./card-form";
import { CardVisual } from "./card-visual";
import { PayInvoiceDialog } from "./pay-invoice-dialog";

/** Fatura inicial: a vencida ou a próxima a pagar; senão a aberta. */
function defaultRef(invoices: InvoiceSummary[]) {
  const today = todayISO();
  return (
    invoices.find((i) => i.status === "OVERDUE")?.referenceMonth ??
    invoices.find((i) => i.status === "CLOSED")?.referenceMonth ??
    invoices.find((i) => i.status === "OPEN" || i.closingDate > today)?.referenceMonth ??
    invoices.at(-1)?.referenceMonth ??
    null
  );
}

export function CardDetailView({ id }: { id: string }) {
  const router = useRouter();
  const hidden = useUiStore((s) => s.privacyMode);
  const openNew = useComposer((s) => s.openNew);
  const openEdit = useComposer((s) => s.openEdit);
  const card = useCard(id);
  const invoices = useInvoices(id);
  const spending = useCardSpending(id);
  const archive = useToggleCardArchive();
  const del = useDeleteCard();
  const [picked, setRef] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Até a pessoa escolher, a fatura exibida é derivada da lista (sem efeito extra).
  const ref = picked ?? (invoices.data ? defaultRef(invoices.data) : null);
  const invoice = useInvoice(id, ref);

  const spendRows = useMemo(() => (spending.data ?? []).map((s) => ({ month: shortMonth(s.referenceMonth), fatura: toNumber(s.total) })), [spending.data]);
  const money = (v: string) => (hidden ? "R$ ••••" : formatCurrency(v));

  if (card.isPending) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-8 w-48" /><Skeleton className="h-56 w-full max-w-sm rounded-xl" /></div>;
  if (card.isError || !card.data) return <Card><ErrorState description={userMessage(card.error)} onRetry={() => void card.refetch()} /></Card>;
  const c = card.data;
  const inv = invoice.data;
  const status = inv ? INVOICE_STATUS[inv.status] : null;

  const confirmDelete = async () => {
    try {
      await del.mutateAsync(c.id);
      router.replace("/cartoes");
    } catch (err) {
      setDeleting(false);
      toast.error(userMessage(err), err instanceof ApiError && err.code === "CARD_IN_USE" ? { action: { label: "Arquivar", onClick: () => archive.mutate(c) } } : undefined);
    }
  };

  return (
    <>
      <PageHeader
        title={c.name}
        description={`${c.institution ? `${c.institution} · ` : ""}fecha dia ${c.closingDay}, vence dia ${c.dueDay}. Melhor dia de compra: ${c.bestPurchaseDay}.`}
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Cartões", href: "/cartoes" }, { label: c.name }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => openNew("EXPENSE", null, c.id)}><Plus aria-hidden /> Nova compra</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><IconButton label="Mais ações do cartão" variant="secondary"><MoreHorizontal /></IconButton></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil aria-hidden /> Editar cartão</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => archive.mutate(c)}>{c.status === "ARCHIVED" ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />} {c.status === "ARCHIVED" ? "Reativar" : "Arquivar"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDeleting(true)}><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        <div className="space-y-4">
          <CardVisual name={c.name} brand={c.brand} color={c.color} lastFour={c.lastFourDigits} institution={c.institution} />
          <Card className="p-5">
            <p className="text-xs text-ink-3">Limite disponível</p>
            <Amount value={c.availableLimit} hidden={hidden} className={cn("mt-1 block text-2xl font-semibold tracking-tight", c.overLimit ? "text-negative" : "text-ink")} />
            <Progress className="mt-4" value={c.usagePercent} tone={c.overLimit ? "negative" : c.usagePercent >= 80 ? "warning" : "accent"} label="Limite usado" />
            <p className="num mt-2 flex justify-between text-xs text-ink-3"><span>Usado {money(c.limitUsed)}</span><span>de {money(c.limit)}</span></p>
            <p className="mt-2 text-2xs text-ink-3">O limite usado inclui parcelas das próximas faturas.</p>
          </Card>
          {spendRows.length > 0 && (
            <ChartCard title="Evolução das faturas" takeaway="Total de cada fatura nos últimos meses.">
              <BarChart data={spendRows} xKey="month" series={[{ key: "fatura", label: "Fatura", color: c.color }]} ariaLabel="Total das faturas dos últimos 6 meses" height={180} />
            </ChartCard>
          )}
        </div>

        <div className="space-y-4">
          <nav aria-label="Faturas" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {invoices.isPending ? <Skeleton className="h-10 w-full" /> : (
              <ul className="flex w-max gap-1.5">
                {(invoices.data ?? []).map((i) => {
                  const s = INVOICE_STATUS[i.status];
                  const active = i.referenceMonth === ref;
                  return (
                    <li key={i.referenceMonth}>
                      <button type="button" aria-current={active ? "true" : undefined} onClick={() => setRef(i.referenceMonth)}
                        className={cn("flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-medium ring-1 ring-inset transition-colors", active ? "bg-ink text-ink-inverse ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-line-strong")}>
                        {monthYear(`${i.referenceMonth}-01`)}
                        <span aria-label={s.label} className={cn("size-1.5 rounded-full", { OPEN: "bg-ink-3 dark:bg-accent", CLOSED: "bg-warning", PAID: "bg-positive", OVERDUE: "bg-negative" }[i.status])} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {!inv ? (
            <Card className="space-y-3 p-6" aria-busy="true"><Skeleton className="h-8 w-40" /><Skeleton className="h-24 w-full" /></Card>
          ) : (
            <>
              <Card className={cn("p-5 sm:p-6 transition-opacity", invoice.isFetching && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">Fatura de {monthYear(`${inv.referenceMonth}-01`)}</p>
                      {status && <Badge tone={status.tone}>{status.label}</Badge>}
                    </div>
                    <Amount value={inv.total} hidden={hidden} splitCents className="mt-3 block font-display text-4xl leading-none tracking-[-0.02em] text-ink" />
                  </div>
                  {toNumber(inv.remaining) > 0 && (
                    <Button onClick={() => setPaying(true)} variant={inv.status === "OPEN" ? "secondary" : "primary"}>
                      {inv.status === "OPEN" ? "Antecipar pagamento" : "Pagar fatura"}
                    </Button>
                  )}
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                  <div><dt className="text-ink-3">Fechamento</dt><dd className="mt-0.5 font-medium text-ink">{formatDate(`${inv.closingDate}T12:00:00`, "short")}</dd></div>
                  <div><dt className="text-ink-3">Vencimento</dt><dd className={cn("mt-0.5 font-medium", inv.status === "OVERDUE" ? "text-negative" : "text-ink")}>{formatDate(`${inv.dueDate}T12:00:00`, "short")}</dd></div>
                  <div><dt className="text-ink-3">Pago</dt><dd className="num mt-0.5 font-medium text-ink">{money(inv.paidAmount)}</dd></div>
                  <div><dt className="text-ink-3">Restante</dt><dd className="num mt-0.5 font-medium text-ink">{money(inv.remaining)}</dd></div>
                </dl>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[1fr_16rem]">
                <Card>
                  <CardHeader title="Compras" description={`${inv.transactions.length} ${inv.transactions.length === 1 ? "item" : "itens"}`} />
                  {inv.transactions.length === 0 ? (
                    <EmptyState compact icon={Plus} title="Nenhuma compra nesta fatura" description={`Compras feitas até o dia ${c.closingDay - 1 || "anterior ao fechamento"} entram aqui.`} action={<Button size="sm" onClick={() => openNew("EXPENSE", null, c.id)}>Registrar compra</Button>} />
                  ) : (
                    <ul className="mt-2 divide-y divide-line border-t border-line">
                      {inv.transactions.map((t) => (
                        <li key={t.id}>
                          <button type="button" onClick={() => openEdit(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-sunken/60 sm:px-6">
                            <EntityIcon icon={t.category?.icon ?? "ellipsis"} color={t.category?.color ?? "#64748B"} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{t.description}</span>
                              <span className="block text-xs text-ink-3">{dayLabel(t.date)}{t.installment && ` · parcela ${t.installment.number}/${t.installment.total}`}</span>
                            </span>
                            <Amount value={t.amount} hidden={hidden} className="text-sm font-medium" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {inv.payments.length > 0 && (
                    <div className="border-t border-line px-5 py-4 sm:px-6">
                      <p className="mb-2 text-xs font-medium text-ink-2">Pagamentos</p>
                      <ul className="space-y-2">
                        {inv.payments.map((p) => (
                          <li key={p.id} className="flex items-center gap-3 text-sm">
                            <ArrowLeftRight className="size-4 text-ink-3" aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-ink-2">{p.account?.name} · {dayLabel(p.date)}</span>
                            <Amount value={p.amount} hidden={hidden} flow="income" className="font-medium" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
                {inv.byCategory.length > 0 && (
                  <Card>
                    <CardHeader title="Por categoria" />
                    <CardBody className="space-y-3">
                      {inv.byCategory.map((b) => (
                        <div key={b.name} className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <EntityIcon icon={b.icon} color={b.color} className="size-5 rounded-[5px] [&_svg]:size-3" />
                            <span className="min-w-0 flex-1 truncate text-ink-2">{b.name}</span>
                            <span className="num font-medium text-ink">{money(b.amount)}</span>
                          </div>
                          <Progress value={toNumber(b.amount)} max={Math.max(toNumber(inv.total), 1)} size="sm" label={`${b.name} na fatura`} />
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CardFormDrawer open={editing} onOpenChange={setEditing} card={c} />
      {paying && inv && <PayInvoiceDialog card={c} invoice={inv} onOpenChange={setPaying} />}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir “${c.name}”?`}
        description="Se o cartão tiver compras, a exclusão será bloqueada — arquive para preservar o histórico."
        confirmLabel="Excluir cartão"
        loading={del.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
