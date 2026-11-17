"use client";

import { Banknote, Building2, Car, CreditCard, Gift, Landmark, MoreHorizontal, Pencil, Plus, Receipt, Trash2, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LineChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { shortMonth } from "@/features/dashboard/api";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import type { Asset, Liability, NetWorthGroup, NetWorthItem } from "@/types/wealth";
import { useAssets, useDeleteWealthItem, useLiabilities, useNetWorth } from "../api";
import { AssetDialog, LiabilityDialog, PayLiabilityDialog } from "./wealth-dialogs";

/** A API sugere rotas de detalhe; mapeamos para as telas que existem. */
function routeFor(it: NetWorthItem): string | undefined {
  if (it.source === "CARD") return `/cartoes/${it.id}`;
  if (it.source === "ACCOUNT") return "/contas";
  if (it.source === "INVESTMENT") return "/investimentos";
  return undefined; // bens e dívidas são editados aqui mesmo
}

const GROUP_ICONS: Record<string, typeof Wallet> = {
  CASH: Wallet, INVESTMENTS: TrendingUp, REAL_ESTATE: Building2, VEHICLE: Car, OTHER: Gift,
  CREDIT_CARD: CreditCard, LOAN: Banknote, FINANCING: Landmark, DEBT: Receipt,
};

type Editing = { kind: "asset"; item: Asset | null } | { kind: "liability"; item: Liability | null } | null;

function GroupList({ title, total, groups, tone, hidden, actions }: {
  title: string;
  total: string;
  groups: NetWorthGroup[];
  tone: "asset" | "liability";
  hidden: boolean;
  actions: (item: NetWorthItem) => React.ReactNode;
}) {
  const money = (v: string) => (hidden ? "R$ ••••" : formatCurrency(v));
  return (
    <Card>
      <CardHeader title={title} action={<span className="num text-sm font-semibold text-ink">{money(total)}</span>} />
      {groups.length === 0 ? (
        <p className="px-5 pb-6 pt-3 text-sm text-ink-3 sm:px-6">{tone === "asset" ? "Nenhum ativo ainda." : "Nenhuma dívida registrada. Ótimo."}</p>
      ) : (
        <div className="mt-3 divide-y divide-line border-t border-line">
          {groups.map((g) => {
            const Icon = GROUP_ICONS[g.key] ?? Wallet;
            const share = toNumber(total) > 0 ? (toNumber(g.total) / toNumber(total)) * 100 : 0;
            return (
              <section key={g.key} aria-label={g.label} className="px-5 py-4 sm:px-6">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="size-4 text-ink-3" aria-hidden />
                  <h3 className="flex-1 text-sm font-medium text-ink">{g.label}</h3>
                  <span className="num text-xs text-ink-3">{formatPercent(share, { fractionDigits: 0 })}</span>
                  <span className="num text-sm font-medium text-ink">{money(g.total)}</span>
                </div>
                <ul className="space-y-1">
                  {g.items.map((it) => (
                    <li key={`${it.source}-${it.id}`} className="flex items-center gap-2 pl-6 text-sm">
                      {routeFor(it) ? <Link href={routeFor(it)!} className="min-w-0 flex-1 truncate text-ink-2 hover:text-ink hover:underline">{it.name}</Link> : <span className="min-w-0 flex-1 truncate text-ink-2">{it.name}</span>}
                      <span className="num text-ink-2">{money(it.value)}</span>
                      <span className="w-8">{actions(it)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function NetWorthView() {
  const hidden = useUiStore((s) => s.privacyMode);
  const nw = useNetWorth();
  const assets = useAssets();
  const liabilities = useLiabilities();
  const del = useDeleteWealthItem();
  const [editing, setEditing] = useState<Editing>(null);
  const [paying, setPaying] = useState<Liability | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "assets" | "liabilities"; id: string; name: string } | null>(null);
  const d = nw.data;

  const itemMenu = (it: NetWorthItem) => {
    if (it.source === "ASSET") {
      const a = assets.data?.find((x) => x.id === it.id);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton label={`Ações de ${it.name}`} size="icon-sm"><MoreHorizontal /></IconButton></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => a && setEditing({ kind: "asset", item: a })}><Pencil aria-hidden /> Atualizar valor</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setDeleting({ kind: "assets", id: it.id, name: it.name })}><Trash2 aria-hidden /> Remover</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (it.source === "LIABILITY") {
      const l = liabilities.data?.find((x) => x.id === it.id);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton label={`Ações de ${it.name}`} size="icon-sm"><MoreHorizontal /></IconButton></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => l && setPaying(l)}><Receipt aria-hidden /> Registrar pagamento</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => l && setEditing({ kind: "liability", item: l })}><Pencil aria-hidden /> Editar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setDeleting({ kind: "liabilities", id: it.id, name: it.name })}><Trash2 aria-hidden /> Remover</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return null;
  };

  return (
    <>
      <PageHeader
        title="Patrimônio"
        description="Tudo o que é seu menos tudo o que você deve. Contas, investimentos e cartões entram automaticamente; bens e dívidas você adiciona aqui."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Patrimônio" }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing({ kind: "liability", item: null })}><Plus aria-hidden /> Dívida</Button>
            <Button onClick={() => setEditing({ kind: "asset", item: null })}><Plus aria-hidden /> Bem</Button>
          </>
        }
      />

      {nw.isPending ? (
        <div className="space-y-4" aria-busy="true"><Skeleton className="h-16 w-72" /><Skeleton className="h-64 w-full" /></div>
      ) : nw.isError || !d ? (
        <Card><ErrorState description={userMessage(nw.error)} onRetry={() => void nw.refetch()} /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <NetWorthHero netWorth={d.netWorth} assets={d.assets.total} liabilities={d.liabilities.total} change={d.change12m?.percent ?? undefined} hidden={hidden} />
            {d.debtRatio !== null && (
              <Card className="p-5">
                <p className="text-xs text-ink-3">Endividamento</p>
                <p className="num mt-1 text-2xl font-semibold text-ink">{formatPercent(d.debtRatio)}</p>
                <p className="mt-1 text-xs text-ink-2">dos seus ativos estão comprometidos com dívidas. Quanto menor, mais sólido o patrimônio.</p>
              </Card>
            )}
          </div>

          <ChartCard
            title="Evolução patrimonial"
            takeaway="Ativos, passivos e patrimônio líquido ao fim de cada mês."
            legend={[{ label: "Patrimônio líquido", color: "var(--brass)" }, { label: "Ativos", color: "var(--series-1)" }, { label: "Passivos", color: "var(--series-2)" }]}
          >
            <LineChart
              data={d.series.map((p) => ({ month: shortMonth(p.month), liquido: toNumber(p.netWorth), ativos: toNumber(p.assets), passivos: toNumber(p.liabilities) }))}
              xKey="month"
              domain={["auto", "auto"]}
              series={[
                { key: "liquido", label: "Patrimônio líquido", color: "var(--brass)" },
                { key: "ativos", label: "Ativos", color: "var(--series-1)" },
                { key: "passivos", label: "Passivos", color: "var(--series-2)" },
              ]}
              ariaLabel="Evolução de ativos, passivos e patrimônio líquido nos últimos 12 meses"
              height={260}
            />
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <GroupList title="Ativos" total={d.assets.total} groups={d.assets.groups} tone="asset" hidden={hidden} actions={itemMenu} />
            <GroupList title="Passivos" total={d.liabilities.total} groups={d.liabilities.groups} tone="liability" hidden={hidden} actions={itemMenu} />
          </div>
        </div>
      )}

      {editing?.kind === "asset" && <AssetDialog key={editing.item?.id ?? "new"} asset={editing.item} onOpenChange={(v) => !v && setEditing(null)} />}
      {editing?.kind === "liability" && <LiabilityDialog key={editing.item?.id ?? "new"} liability={editing.item} onOpenChange={(v) => !v && setEditing(null)} />}
      {paying && <PayLiabilityDialog liability={paying} onOpenChange={(v) => !v && setPaying(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remover “${deleting?.name ?? ""}”?`}
        description="O item deixa de contar no seu patrimônio."
        confirmLabel="Remover"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate({ kind: deleting.kind, id: deleting.id }, { onSettled: () => setDeleting(null) })}
      />
    </>
  );
}
