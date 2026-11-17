"use client";

import { ArrowRight, CalendarClock, Compass, Shield, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { StatTile } from "@/components/finance/stat-tile";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/ui/states";
import { MonthNavigator } from "@/features/transactions/components/filters-bar";
import { cn } from "@/lib/cn";
import { currentMonth, type MonthRef } from "@/lib/dates";
import { userMessage } from "@/services/api-error";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { useAccounts } from "@/features/accounts/api";
import { useBudgets } from "@/features/budgets/api";
import { useDashboard, useMarketInsights } from "../api";
import { useConnections } from "@/features/connect/api";
import { AttentionCard, attentionItems, ClaudePromo, GettingStarted, MonthSummary, setupProgress, type SetupState } from "./dashboard-panels";
import { CashflowChart, GoalsCard, InsightsCard, NetWorthChart, RecentCard, SpendingChart, UpcomingCard } from "./dashboard-sections";
import { InsightTicker } from "./insight-ticker";

const ym = ({ year, month }: MonthRef) => `${year}-${String(month + 1).padStart(2, "0")}`;

function greeting(name: string) {
  const h = new Date().getHours();
  const first = name.split(" ")[0] ?? "";
  return `${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"}, ${first}`;
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando painel" className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4"><Skeleton className="h-3 w-32" /><Skeleton className="h-14 w-72" /><Skeleton className="h-3 w-full max-w-xl" /></div>
        <Card className="space-y-4 p-6"><Skeleton className="h-4 w-40" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</Card>
      </div>
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Card key={i} className="space-y-3 p-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-32" /></Card>)}
      </div>
      <Card className="p-6"><Skeleton className="h-64 w-full rounded-md" /></Card>
    </div>
  );
}

export function DashboardView() {
  const user = useAuthStore((s) => s.user);
  const hidden = useUiStore((s) => s.privacyMode);
  const setupDismissed = useUiStore((s) => s.setupDismissed);
  const dismissSetup = useUiStore((s) => s.dismissSetup);
  const claudePromoDismissed = useUiStore((s) => s.claudePromoDismissed);
  const dismissClaudePromo = useUiStore((s) => s.dismissClaudePromo);
  const connections = useConnections();
  const [month, setMonth] = useState<MonthRef>(currentMonth);
  const query = useDashboard(ym(month));
  const market = useMarketInsights();
  const budgets = useBudgets(ym(month));
  const accounts = useAccounts("ACTIVE");
  const d = query.data;
  const isCurrentMonth = ym(month) === ym(currentMonth());

  const budgetList = budgets.data?.data ?? [];
  const setup: SetupState | null =
    d && accounts.data && budgets.data
      ? {
          hasAccount: accounts.data.data.length > 0,
          hasTransactions: d.recent.length > 0 || d.upcoming.length > 0,
          hasBudget: budgetList.length > 0,
          hasGoal: d.goals.length > 0,
          hasReserve: d.emergencyFund !== null,
        }
      : null;
  // Sem conta e sem lançamento o painel só teria zeros: mostra o caminho em vez de gráficos vazios.
  const empty = setup !== null && !setup.hasAccount && !setup.hasTransactions;
  const showSetup = setup !== null && !setupProgress(setup).complete && (empty || !setupDismissed);
  // Um convite por vez: o do Claude só aparece quando os primeiros passos já não estão na tela.
  const showClaudePromo = setup !== null && !empty && !showSetup && !claudePromoDismissed && connections.data?.length === 0;

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-3">{user ? greeting(user.name) : ""}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Painel</h1>
        </div>
        {!empty && (
          <div data-tour="month" className="self-start sm:self-auto">
            <MonthNavigator value={month} onChange={setMonth} />
          </div>
        )}
      </div>

      {user && !user.onboardingCompleted && (
        <Card className="mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brass-soft text-brass"><Compass className="size-5" aria-hidden /></span>
            <div>
              <p className="text-sm font-medium text-ink">Monte sua primeira visão financeira</p>
              <p className="text-sm text-ink-2">Sete perguntas rápidas e o Lastro calcula patrimônio, reserva ideal e sua primeira meta.</p>
            </div>
          </div>
          <Link href="/onboarding" className={buttonVariants({ className: "shrink-0" })}>Começar <ArrowRight aria-hidden /></Link>
        </Card>
      )}

      {showSetup && <GettingStarted state={setup} onDismiss={empty ? undefined : dismissSetup} />}
      {showClaudePromo && <ClaudePromo onDismiss={dismissClaudePromo} />}

      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError || !d ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : empty ? (
        <InsightTicker personal={[]} market={market.data?.insights ?? []} title="Mercado hoje" subtitle="câmbio, cripto e bolsa" />
      ) : (
        <div className={cn("space-y-4 transition-opacity", query.isFetching && "opacity-70")}>
          {/* 1. A resposta principal: quanto eu tenho e como está o mês. */}
          <div className="grid gap-10 pb-6 lg:grid-cols-[1.25fr_1fr] lg:items-center">
            <div data-tour="net-worth">
              <NetWorthHero
                netWorth={d.netWorth.current}
                hidden={hidden}
                assets={d.netWorth.assets}
                liabilities={d.netWorth.liabilities}
                change={d.netWorth.change12m ?? undefined}
              />
            </div>
            <MonthSummary flow={d.flow} hidden={hidden} isCurrentMonth={isCurrentMonth} />
          </div>

          {/* 2. Onde o dinheiro está. */}
          <div data-tour="stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Saldo em contas" value={d.cash.available} icon={Wallet} explainer="Soma das contas correntes, digitais, poupança e carteiras incluídas no patrimônio. Não inclui investimentos." footer={<TileLink href="/contas">Ver contas</TileLink>} />
            <StatTile label="Investimentos" value={d.investments.total} icon={TrendingUp} explainer="Valor atual da sua carteira de investimentos." footer={<TileLink href="/investimentos">Ver carteira</TileLink>} />
            <StatTile
              label="Reserva de emergência"
              value={d.emergencyFund?.current ?? 0}
              icon={Shield}
              explainer="Dinheiro guardado para imprevistos. O ideal é cobrir de 6 a 12 meses do seu custo de vida."
              footer={
                d.emergencyFund ? (
                  <div className="space-y-1.5">
                    <Progress value={d.emergencyFund.progress ?? 0} tone="brass" size="sm" label="Progresso da reserva" />
                    <p className="num text-2xs text-ink-3">
                      {d.emergencyFund.coverageMonths !== null ? `Cobre ${formatMonths(d.emergencyFund.coverageMonths)} de ${d.emergencyFund.targetMonths}` : `Meta: ${d.emergencyFund.targetMonths} meses`}
                    </p>
                  </div>
                ) : (
                  <TileLink href="/reserva">Configurar reserva</TileLink>
                )
              }
            />
            <StatTile
              label="A pagar em 30 dias"
              value={d.commitments.next30Days}
              icon={CalendarClock}
              explainer="Lançamentos pendentes dos próximos 30 dias mais parcelas mensais de dívidas."
              footer={<p className="text-2xs text-ink-3">{d.commitments.pendingCount} {d.commitments.pendingCount === 1 ? "lançamento pendente" : "lançamentos pendentes"}</p>}
            />
          </div>

          {/* 3. O que fazer agora e o que os números dizem. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AttentionCard items={attentionItems(d, budgetList)} hidden={hidden} />
            <div data-tour="insights" className="min-w-0">
              <InsightsCard insights={d.insights} />
            </div>
          </div>

          {/* 4. Tendências. */}
          <div className="grid gap-4 lg:grid-cols-3">
            <NetWorthChart data={d} />
            <SpendingChart data={d} />
            <CashflowChart data={d} />
            <GoalsCard goals={d.goals} />
            <div className="grid gap-4 lg:col-span-3 lg:grid-cols-2">
              <UpcomingCard data={d} />
              <RecentCard data={d} />
            </div>
          </div>

          <InsightTicker personal={[]} market={market.data?.insights ?? []} title="Mercado hoje" subtitle="câmbio, cripto e bolsa" className="pt-6" />
        </div>
      )}
    </>
  );
}

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-2xs font-medium text-ink-3 hover:text-ink">
      {children} <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}

function formatMonths(n: number) {
  const v = Math.round(n * 10) / 10;
  return `${v.toLocaleString("pt-BR")} ${v === 1 ? "mês" : "meses"}`;
}
