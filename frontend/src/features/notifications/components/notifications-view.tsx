"use client";

import { Bell, CalendarClock, CheckCheck, CreditCard, Gauge, Repeat, Shield, Sparkles, Target, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { userMessage } from "@/services/api-error";
import type { AppNotification } from "@/types/planning";
import { useDeleteNotification, useDeleteRead, useMarkAllRead, useMarkRead, useNotificationsPage } from "../api";

const TYPES: Record<string, { icon: typeof Bell; tone: string }> = {
  BUDGET_THRESHOLD: { icon: Gauge, tone: "bg-warning-soft text-warning" },
  BUDGET_EXCEEDED: { icon: TriangleAlert, tone: "bg-negative-soft text-negative" },
  BILL_DUE: { icon: CalendarClock, tone: "bg-accent-soft text-accent" },
  INVOICE_DUE: { icon: CreditCard, tone: "bg-accent-soft text-accent" },
  GOAL_BEHIND: { icon: Target, tone: "bg-warning-soft text-warning" },
  GOAL_COMPLETED: { icon: Target, tone: "bg-positive-soft text-positive" },
  EMERGENCY_BELOW_TARGET: { icon: Shield, tone: "bg-surface-sunken text-ink-2" },
  RECURRING_CREATED: { icon: Repeat, tone: "bg-surface-sunken text-ink-2" },
  NEW_TRANSACTION: { icon: Wallet, tone: "bg-surface-sunken text-ink-2" },
  WEEKLY_SUMMARY: { icon: Sparkles, tone: "bg-brass-soft text-brass" },
};

const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const hrefOf = (n: AppNotification) => (typeof n.data?.href === "string" && n.data.href.startsWith("/") ? n.data.href : null);

function Row({ n, onOpen, onDelete }: { n: AppNotification; onOpen: () => void; onDelete: () => void }) {
  const t = TYPES[n.type] ?? { icon: Bell, tone: "bg-surface-sunken text-ink-2" };
  const Icon = t.icon;
  const unread = !n.readAt;
  return (
    <li className={cn("group relative flex gap-3.5 px-5 py-4 transition-colors hover:bg-surface-sunken/50 sm:px-6", unread && "bg-accent-soft/40")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", t.tone)}><Icon className="size-4" aria-hidden /></span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent">
        <p className={cn("text-sm text-ink", unread && "font-medium")}>
          {unread && <span className="sr-only">Não lida: </span>}
          {n.title}
        </p>
        <p className="text-sm text-ink-2">{n.body}</p>
        <p className="mt-1 text-xs text-ink-3">{when(n.createdAt)}</p>
      </button>
      {unread && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
      <IconButton label="Excluir notificação" size="icon-sm" onClick={onDelete} className="relative z-10 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><Trash2 /></IconButton>
    </li>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const q = useNotificationsPage(unreadOnly, page);
  const read = useMarkRead();
  const readAll = useMarkAllRead();
  const del = useDeleteNotification();
  const delRead = useDeleteRead();
  const list = q.data?.data ?? [];
  const meta = q.data?.meta;

  const open = (n: AppNotification) => {
    if (!n.readAt) read.mutate(n.id);
    const href = hrefOf(n);
    if (href) router.push(href);
  };

  return (
    <>
      <PageHeader
        title="Notificações"
        description="Vencimentos, faturas, orçamento, metas e reserva. Escolha o que receber em Perfil › Notificações."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Notificações" }]}
        actions={
          <>
            <Button variant="ghost" loading={delRead.isPending} onClick={() => delRead.mutate(undefined)}>Limpar lidas</Button>
            {meta && meta.unreadCount > 0 && <Button variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate(undefined)}><CheckCheck aria-hidden /> Marcar todas como lidas</Button>}
          </>
        }
      />
      <Tabs value={unreadOnly ? "unread" : "all"} onValueChange={(v) => { setUnreadOnly(v === "unread"); setPage(1); }} className="mb-5">
        <TabsList aria-label="Filtrar">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">Não lidas{meta && meta.unreadCount > 0 ? ` (${meta.unreadCount})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>
      {q.isPending ? (
        <Card className="space-y-3 p-6" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</Card>
      ) : q.isError ? (
        <Card><ErrorState description={userMessage(q.error)} onRetry={() => void q.refetch()} /></Card>
      ) : list.length === 0 ? (
        <Card><EmptyState icon={Bell} title={unreadOnly ? "Nada pendente" : "Tudo em dia"} description="Avisamos aqui quando uma conta ou fatura estiver para vencer, um orçamento chegar ao limite ou uma meta sair do ritmo." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">{list.map((n) => <Row key={n.id} n={n} onOpen={() => open(n)} onDelete={() => del.mutate(n.id)} />)}</ul>
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="font-medium text-accent disabled:text-ink-3">Anterior</button>
              <span className="num">Página {page} de {meta.totalPages}</span>
              <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="font-medium text-accent disabled:text-ink-3">Próxima</button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
