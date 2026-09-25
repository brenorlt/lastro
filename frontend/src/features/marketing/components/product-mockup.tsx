"use client";

import { ArrowDownLeft, ArrowUpRight, Shield, TrendingUp, Wallet } from "lucide-react";
import { DonutChart, LineChart } from "@/components/charts/charts";
import { Amount, Delta } from "@/components/finance/amount";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { StatTile } from "@/components/finance/stat-tile";
import { Badge, Card } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";

const NET_WORTH_SERIES = [
  { month: "abr", patrimonio: 182400 },
  { month: "mai", patrimonio: 191300 },
  { month: "jun", patrimonio: 199100 },
  { month: "jul", patrimonio: 210400 },
  { month: "ago", patrimonio: 221300 },
  { month: "set", patrimonio: 228750 },
];

const SPENDING = [
  { id: "moradia", label: "Moradia", value: 3400 },
  { id: "alimentacao", label: "Alimentação", value: 1860 },
  { id: "transporte", label: "Transporte", value: 940 },
  { id: "lazer", label: "Lazer", value: 820 },
];

/**
 * Prévia do produto com dados ilustrativos, montada com os mesmos componentes
 * reais do Design System (nunca uma imagem estática) — a interface que a pessoa vê aqui
 * é a mesma que ela usará depois de criar a conta.
 */
export function ProductMockup() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2rem] bg-linear-to-b from-surface-sunken/60 to-transparent blur-2xl sm:-inset-x-12" />
      <Card className="overflow-hidden shadow-lg ring-1 ring-line" role="img" aria-label="Prévia do painel do Lastro com dados ilustrativos">
        <div className="flex items-center gap-1.5 border-b border-line bg-surface-sunken/50 px-4 py-3">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 text-2xs text-ink-3">Lastro · Painel</span>
          <Badge tone="outline" className="ml-auto">Dados ilustrativos</Badge>
        </div>
        <div className="p-5 sm:p-8">
          <NetWorthHero netWorth={228750.42} assets={271900} liabilities={43150} change={25.4} className="mb-8" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Saldo disponível" value={18420.1} icon={Wallet} />
            <StatTile label="Receitas do mês" value={14200} icon={ArrowDownLeft} flow="income" footer={<Delta value={-3.1} suffix="" />} />
            <StatTile label="Despesas do mês" value={9150} icon={ArrowUpRight} footer={<Delta value={-16.1} inverse suffix="" />} />
            <StatTile label="Investimentos" value={186300} icon={TrendingUp} footer={<Delta value={1.2} suffix="no mês" />} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card className="p-5">
              <p className="mb-3 text-sm font-medium text-ink">Evolução patrimonial</p>
              <LineChart
                data={NET_WORTH_SERIES}
                xKey="month"
                domain={["auto", "auto"]}
                series={[{ key: "patrimonio", label: "Patrimônio líquido", color: "var(--brass)" }]}
                ariaLabel="Patrimônio líquido crescendo de abril a setembro"
                height={200}
              />
            </Card>
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink"><Shield className="size-4 text-ink-3" aria-hidden /> Reserva financeira</p>
              <Amount value={42000} className="block text-2xl font-semibold text-ink" />
              <p className="mt-1 text-xs text-ink-3">de {formatCurrency(60780)} · cobre 4,1 meses</p>
              <Progress value={42000} max={60780} tone="brass" className="mt-4" label="Progresso da reserva" />
              <div className="mt-6 flex items-center justify-center">
                <DonutChart data={SPENDING} colors={["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"]} ariaLabel="Distribuição de gastos por categoria" size={120} />
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
