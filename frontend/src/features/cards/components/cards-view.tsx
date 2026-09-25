"use client";

import { CreditCard as CardIcon, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import type { CardStatus, CreditCard } from "@/types/cards";
import { INVOICE_STATUS, useCards } from "../api";
import { CardFormDrawer } from "./card-form";
import { CardVisual } from "./card-visual";

function CardTile({ c, hidden }: { c: CreditCard; hidden: boolean }) {
  const inv = c.nextDueInvoice ?? c.currentInvoice;
  const status = inv ? INVOICE_STATUS[inv.status] : null;
  const money = (v: string) => (hidden ? "R$ ••••" : formatCurrency(v));
  return (
    <Card className="group relative flex flex-col gap-5 p-5 transition-shadow hover:shadow-md">
      <CardVisual name={c.name} brand={c.brand} color={c.color} lastFour={c.lastFourDigits} institution={c.institution} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ink">
            <Link href={`/cartoes/${c.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">{c.name}</Link>
          </h3>
          <p className="text-xs text-ink-3">Fecha dia {c.closingDay} · vence dia {c.dueDay}</p>
        </div>
        {c.status === "ARCHIVED" ? <Badge>Arquivado</Badge> : status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>
      {inv && (
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xs uppercase tracking-[0.08em] text-ink-3">{inv.status === "OPEN" ? "Fatura atual" : "Próxima a pagar"}</p>
            <Amount value={inv.remaining} hidden={hidden} className="mt-1 block text-xl font-semibold tracking-tight text-ink" />
          </div>
          <p className="text-right text-xs text-ink-3">vence {formatDate(`${inv.dueDate}T12:00:00`, "short")}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Progress value={c.usagePercent} tone={c.overLimit ? "negative" : c.usagePercent >= 80 ? "warning" : "accent"} size="sm" label={`Limite usado do ${c.name}`} />
        <p className="num flex justify-between text-2xs text-ink-3">
          <span>Usado {money(c.limitUsed)}</span>
          <span className={c.overLimit ? "text-negative" : undefined}>Disponível {money(c.availableLimit)}</span>
        </p>
      </div>
    </Card>
  );
}

export function CardsView() {
  const hidden = useUiStore((s) => s.privacyMode);
  const [status, setStatus] = useState<CardStatus | "ALL">("ACTIVE");
  const [formOpen, setFormOpen] = useState(false);
  const query = useCards(status);
  const cards = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        title="Cartões"
        description="Faturas, limites e parcelamentos. Compras no cartão contam como despesa na data da compra; o pagamento da fatura só movimenta sua conta."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Cartões" }]}
        actions={<Button onClick={() => setFormOpen(true)}><Plus aria-hidden /> Novo cartão</Button>}
      />

      {meta && cards.length > 0 && status === "ACTIVE" && (
        <dl className="mb-8 grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><dt className="text-xs text-ink-3">Limite total</dt><dd><Amount value={meta.totalLimit} hidden={hidden} className="mt-1 block text-lg font-semibold" /></dd></Card>
          <Card className="p-4"><dt className="text-xs text-ink-3">Limite usado</dt><dd><Amount value={meta.totalUsed} hidden={hidden} className="mt-1 block text-lg font-semibold" /></dd><dd className="text-2xs text-ink-3">inclui parcelas futuras</dd></Card>
          <Card className="p-4">
            <dt className="text-xs text-ink-3">Próximo vencimento</dt>
            {meta.nextDue ? (
              <>
                <dd><Amount value={meta.nextDue.remaining} hidden={hidden} className="mt-1 block text-lg font-semibold" /></dd>
                <dd className="text-2xs text-ink-3">em {formatDate(`${meta.nextDue.dueDate}T12:00:00`, "medium")}</dd>
              </>
            ) : <dd className="mt-1 text-sm text-ink-2">Nada a pagar</dd>}
          </Card>
        </dl>
      )}

      <Tabs value={status} onValueChange={(v) => setStatus(v as CardStatus)} className="mb-5">
        <TabsList aria-label="Filtrar cartões">
          <TabsTrigger value="ACTIVE">Ativos</TabsTrigger>
          <TabsTrigger value="ARCHIVED">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando cartões">
          {[0, 1].map((i) => <Card key={i} className="space-y-4 p-5"><Skeleton className="aspect-[1.586] w-full rounded-xl" /><Skeleton className="h-4 w-32" /></Card>)}
        </div>
      ) : query.isError ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={CardIcon}
            title={status === "ACTIVE" ? "Cadastre seu cartão de crédito" : "Nenhum cartão arquivado"}
            description={status === "ACTIVE" ? "Informe limite, fechamento e vencimento. O Lastro distribui as compras e parcelas nas faturas certas e mostra quanto do limite está comprometido." : "Cartões que você não usa mais ficam aqui com o histórico preservado."}
            action={status === "ACTIVE" ? <Button onClick={() => setFormOpen(true)}><Plus aria-hidden /> Novo cartão</Button> : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => <li key={c.id}><CardTile c={c} hidden={hidden} /></li>)}
        </ul>
      )}

      <CardFormDrawer open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
