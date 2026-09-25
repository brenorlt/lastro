"use client";

import { ArrowLeftRight, Landmark, Plus } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/format";
import { ApiError, userMessage } from "@/services/api-error";
import { useComposer } from "@/stores/composer-store";
import { useUiStore } from "@/stores/ui-store";
import type { Account, AccountType } from "@/types/finance";
import { accountTypeLabel, useAccounts, useDeleteAccount, useToggleArchive, type StatusFilter } from "../api";
import { AccountCard } from "./account-card";
import { AccountFormDrawer } from "./account-form";

function Summary({ total, byType, count }: { total: string; byType: Partial<Record<AccountType, string>>; count: number }) {
  const hidden = useUiStore((s) => s.privacyMode);
  const entries = Object.entries(byType) as [AccountType, string][];
  return (
    <section aria-label="Resumo das contas" className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">Saldo em contas</p>
        <Amount value={total} hidden={hidden} splitCents className="mt-2 block font-display text-4xl leading-none tracking-[-0.02em] text-ink sm:text-5xl" />
        <p className="mt-2 text-xs text-ink-3">
          {count} {count === 1 ? "conta ativa" : "contas ativas"} incluídas no patrimônio
        </p>
      </div>
      {entries.length > 1 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {entries.map(([type, value]) => (
            <div key={type}>
              <dt className="text-ink-3">{accountTypeLabel(type)}</dt>
              <dd className="num font-medium text-ink">{hidden ? "••••" : formatCurrency(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function AccountsView() {
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [editing, setEditing] = useState<Account | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const query = useAccounts(status);
  const toggleArchive = useToggleArchive();
  const openComposer = useComposer((s) => s.openNew);
  const del = useDeleteAccount();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (err) {
      const inUse = err instanceof ApiError && err.code === "ACCOUNT_IN_USE";
      toast.error(userMessage(err), inUse ? { action: { label: "Arquivar", onClick: () => toggleArchive.mutate(deleting) } } : undefined);
      setDeleting(null);
    }
  };

  const accounts = query.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Contas"
        description="Onde seu dinheiro está guardado. O saldo de cada conta se atualiza com seus lançamentos."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Contas" }]}
        actions={
          <>
            {accounts.length > 1 && status === "ACTIVE" && (
              <Button variant="secondary" onClick={() => openComposer("TRANSFER")}>
                <ArrowLeftRight aria-hidden /> Transferir
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus aria-hidden /> Nova conta
            </Button>
          </>
        }
      />

      {query.data && status === "ACTIVE" && accounts.length > 0 && (
        <Summary total={query.data.meta?.totalBalance ?? "0"} byType={query.data.meta?.byType ?? {}} count={accounts.filter((a) => a.includeInNetWorth).length} />
      )}

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)} className="mb-5">
        <TabsList aria-label="Filtrar contas">
          <TabsTrigger value="ACTIVE">Ativas</TabsTrigger>
          <TabsTrigger value="ARCHIVED">Arquivadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando contas">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="space-y-6 p-5">
              <div className="flex gap-3"><Skeleton className="size-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div></div>
              <Skeleton className="h-6 w-36" />
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : accounts.length === 0 ? (
        <Card>
          {status === "ACTIVE" ? (
            <EmptyState
              icon={Landmark}
              title="Cadastre sua primeira conta"
              description="Comece pela conta onde seu salário cai. Depois adicione poupança, carteira e corretoras — o Lastro soma tudo no seu patrimônio."
              action={<Button onClick={openCreate}><Plus aria-hidden /> Nova conta</Button>}
            />
          ) : (
            <EmptyState compact icon={Landmark} title="Nenhuma conta arquivada" description="Contas que você não usa mais podem ser arquivadas: saem das listas, mas o histórico é preservado." />
          )}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <li key={a.id}>
              <AccountCard account={a} onEdit={() => openEdit(a)} onToggleArchive={() => toggleArchive.mutate(a)} onDelete={() => setDeleting(a)} />
            </li>
          ))}
        </ul>
      )}

      <AccountFormDrawer open={formOpen} onOpenChange={setFormOpen} account={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description="A conta deixa de existir. Se ela tiver lançamentos, a exclusão será bloqueada — nesse caso, arquive para preservar o histórico."
        confirmLabel="Excluir conta"
        loading={del.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
