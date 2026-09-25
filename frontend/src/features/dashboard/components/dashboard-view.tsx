"use client";

import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarClock, Compass, Shield, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Delta } from "@/components/finance/amount";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { StatTile } from "@/components/finance/stat-tile";
import { buttonVariants } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/ui/states";
import { MonthNavigator } from "@/features/transactions/components/filters-bar";
import { cn } from "@/lib/cn";
import { currentMonth, type MonthRef } from "@/lib/dates";
import { formatCurrency, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { pctChange, useDashboard } from "../api";
import { CashflowChart, GoalsCard, InsightsCard, NetWorthChart, RecentCard, SpendingChart, UpcomingCard } from "./dashboard-sections";

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
      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Card key={i} className="space-y-3 p-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-32" /></Card>)}
      </div>
      <Card className="p-6"><Skeleton className="h-64 w-full rounded-md" /></Card>
    </div>
  );
}

export function DashboardView() {
  const user = useAuthStore((s) => s.user);
  const hidden = useUiStore((s) => s.privacyMode);
  const [month, setMonth] = useState<MonthRef>(currentMonth);
  const query = useDashboard(ym(month));
  const d = query.data;

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-3">{user ? greeting(user.name) : ""}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Painel</h1>
        </div>
        <MonthNavigator value={month} onChange={setMonth} />
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

      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError || !d ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : (
        <div className={cn("space-y-4 transition-opacity", query.isFetching && "opacity-70")}>
          <div className="grid gap-10 pb-6 lg:grid-cols-[1.25fr_1fr] lg:items-end">
            <NetWorthHero
              netWorth={d.netWorth.current}
              hidden={hidden}
              assets={d.netWorth.assets}
              liabilities={d.netWorth.liabilities}
              change={d.netWorth.change12m ?? undefined}
            />
            <InsightsCard insights={d.insights} />
          </div>

          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Saldo disponível" value={d.cash.available} icon={Wallet} explainer="Soma das contas correntes, digitais, poupança e carteiras incluídas no patrimônio. Não inclui investimentos." />
            <StatTile
              label="Receitas do mês"
              value={d.flow.income}
              icon={ArrowDownLeft}
              flow="income"
              footer={pctChange(toNumber(d.flow.income), toNumber(d.flow.previousIncome)) !== null && <Delta value={pctChange(toNumber(d.flow.income), toNumber(d.flow.previousIncome))!} />}
            />
            <StatTile
              label="Despesas do mês"
              value={d.flow.expense}
              icon={ArrowUpRight}
              footer={pctChange(toNumber(d.flow.expense), toNumber(d.flow.previousExpense)) !== null && <Delta value={pctChange(toNumber(d.flow.expense), toNumber(d.flow.previousExpense))!} inverse />}
            />
            <StatTile label="Investimentos" value={d.investments.total} icon={TrendingUp} explainer="Saldo das contas de investimento. O detalhamento por ativo chega no módulo de investimentos." />
            <StatTile
              label="Reserva financeira"
              value={d.emergencyFund?.current ?? 0}
              icon={Shield}
              explainer="Dinheiro guardado para imprevistos. O ideal é cobrir de 6 a 12 meses do seu custo de vida."
              footer={
                d.emergencyFund ? (
                  <div className="space-y-1.5">
                    <Progress value={d.emergencyFund.progress ?? 0} tone="brass" size="sm" label="Progresso da reserva" />
                    <p className="num text-2xs text-ink-3">Meta: {formatCurrency(d.emergencyFund.target)} ({d.emergencyFund.targetMonths} meses)</p>
                  </div>
                ) : (
                  <p className="text-2xs text-ink-3">Defina sua reserva no onboarding.</p>
                )
              }
            />
            <StatTile
              label="Compromissos futuros"
              value={d.commitments.next30Days}
              icon={CalendarClock}
              explainer="Lançamentos pendentes dos próximos 30 dias mais parcelas mensais de dívidas."
              footer={<p className="text-2xs text-ink-3">{d.commitments.pendingCount} pendente{d.commitments.pendingCount === 1 ? "" : "s"}</p>}
            />
          </div>

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
        </div>
      )}
    </>
  );
}
