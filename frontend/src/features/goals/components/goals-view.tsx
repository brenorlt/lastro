"use client";

import { Archive, MoreHorizontal, Pause, Pencil, Play, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import type { Goal } from "@/types/planning";
import { goalCategoryLabel, useDeleteGoal, useGoals, useUpdateGoalStatus, type GoalFilter } from "../api";
import { monthYear } from "../model";
import { GoalDetailDrawer } from "./goal-detail";
import { GoalFormDrawer } from "./goal-form";

function StatusBadge({ g }: { g: Goal }) {
  if (g.status === "COMPLETED") return <Badge tone="positive">Concluída</Badge>;
  if (g.status === "PAUSED") return <Badge>Pausada</Badge>;
  if (g.status === "ARCHIVED") return <Badge tone="outline">Arquivada</Badge>;
  if (g.onTrack === true) return <Badge tone="positive">No ritmo</Badge>;
  if (g.onTrack === false) return <Badge tone="warning">Abaixo do ritmo</Badge>;
  return null;
}

function planLine(g: Goal) {
  if (g.status === "COMPLETED") return "Objetivo alcançado.";
  if (g.requiredMonthly) return `Guarde ${formatCurrency(g.requiredMonthly)}/mês até ${monthYear(g.targetDate!)}`;
  if (g.projectedCompletionDate) return `No ritmo atual, você chega lá em ${monthYear(g.projectedCompletionDate)}`;
  return "Defina um prazo para calcular quanto guardar por mês.";
}

function GoalCard({ g, hidden, onOpen, onEdit, onStatus, onDelete }: {
  g: Goal;
  hidden: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onStatus: (s: Goal["status"]) => void;
  onDelete: () => void;
}) {
  return (
    <Card className={cn("relative flex flex-col gap-5 p-5 transition-shadow hover:shadow-md", g.status === "PAUSED" && "opacity-75")}>
      <div className="flex items-start gap-3">
        <EntityIcon icon={g.icon} color={g.color} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-ink">
            <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">{g.name}</button>
          </h3>
          <p className="truncate text-xs text-ink-3">{goalCategoryLabel(g.category)}{g.priority === "HIGH" ? " · prioridade alta" : ""}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton label={`Ações de ${g.name}`} size="icon-sm" className="relative z-10 -mr-1.5 -mt-1"><MoreHorizontal /></IconButton></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Editar</DropdownMenuItem>
            {g.status === "PAUSED" ? (
              <DropdownMenuItem onSelect={() => onStatus("ACTIVE")}><Play aria-hidden /> Retomar</DropdownMenuItem>
            ) : g.status === "ACTIVE" ? (
              <DropdownMenuItem onSelect={() => onStatus("PAUSED")}><Pause aria-hidden /> Pausar</DropdownMenuItem>
            ) : null}
            {g.status !== "ARCHIVED" && <DropdownMenuItem onSelect={() => onStatus("ARCHIVED")}><Archive aria-hidden /> Arquivar</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Amount value={g.currentAmount} hidden={hidden} className="text-xl font-semibold tracking-tight text-ink" />
          <span className="num text-xs text-ink-3">de {hidden ? "••••" : formatCurrency(g.targetAmount)}</span>
        </div>
        <Progress value={toNumber(g.currentAmount)} max={Math.max(toNumber(g.targetAmount), 1)} tone={g.status === "COMPLETED" ? "positive" : "accent"} label={`Progresso de ${g.name}: ${formatPercent(g.progress, { fractionDigits: 0 })}`} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-xs text-ink-2">{planLine(g)}</p>
        <StatusBadge g={g} />
      </div>
    </Card>
  );
}

export function GoalsView() {
  const hidden = useUiStore((s) => s.privacyMode);
  const [filter, setFilter] = useState<GoalFilter>("OPEN");
  const query = useGoals(filter);
  const status = useUpdateGoalStatus();
  const del = useDeleteGoal();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const goals = query.data?.data ?? [];
  const meta = query.data?.meta;

  const openCreate = () => { setEditing(null); setFormOpen(true); };

  return (
    <>
      <PageHeader
        title="Metas"
        description="Objetivos com valor e prazo. O Lastro calcula quanto guardar por mês e mostra se você está no ritmo."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Metas" }]}
        actions={<Button onClick={openCreate}><Plus aria-hidden /> Nova meta</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as GoalFilter)}>
          <TabsList aria-label="Filtrar metas">
            <TabsTrigger value="OPEN">Em andamento</TabsTrigger>
            <TabsTrigger value="COMPLETED">Concluídas</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Arquivadas</TabsTrigger>
          </TabsList>
        </Tabs>
        {meta && meta.count > 0 && (
          <p className="num text-xs text-ink-3">
            {hidden ? "••••" : formatCurrency(meta.totalSaved)} guardados de {hidden ? "••••" : formatCurrency(meta.totalTarget)}
          </p>
        )}
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando metas">
          {[0, 1, 2].map((i) => <Card key={i} className="space-y-5 p-5"><Skeleton className="h-10 w-40" /><Skeleton className="h-2 w-full" /><Skeleton className="h-3 w-48" /></Card>)}
        </div>
      ) : query.isError ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : goals.length === 0 ? (
        <Card>
          {filter === "OPEN" ? (
            <EmptyState
              icon={Target}
              title="Transforme um objetivo em meta"
              description="Viagem, carro, imóvel, aposentadoria: diga quanto e até quando — calculamos o aporte mensal e acompanhamos seu ritmo."
              action={<Button onClick={openCreate}><Plus aria-hidden /> Criar meta</Button>}
            />
          ) : (
            <EmptyState compact icon={Target} title={filter === "COMPLETED" ? "Nenhuma meta concluída ainda" : "Nenhuma meta arquivada"} description="Elas aparecerão aqui." />
          )}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(filter === "OPEN" ? goals.filter((g) => g.status === "ACTIVE" || g.status === "PAUSED") : goals.filter((g) => g.status === filter)).map((g) => (
            <li key={g.id}>
              <GoalCard
                g={g}
                hidden={hidden}
                onOpen={() => setOpenId(g.id)}
                onEdit={() => { setEditing(g); setFormOpen(true); }}
                onStatus={(s) => status.mutate({ id: g.id, status: s })}
                onDelete={() => setDeleting(g)}
              />
            </li>
          ))}
        </ul>
      )}

      <GoalFormDrawer open={formOpen} onOpenChange={setFormOpen} goal={editing} />
      <GoalDetailDrawer goalId={openId} onOpenChange={(v) => !v && setOpenId(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Excluir a meta “${deleting?.name ?? ""}”?`}
        description="O histórico de aportes da meta também será removido. Seus lançamentos e contas não são afetados."
        confirmLabel="Excluir meta"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
      />
    </>
  );
}
