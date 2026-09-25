"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarClock, PiggyBank, Shield, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { BarChart, DonutChart, LineChart, SERIES } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { Delta } from "@/components/finance/amount";
import { EstimateBadge, EstimateDisclaimer } from "@/components/finance/estimate-note";
import { Insight } from "@/components/finance/insight-card";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { StatTile } from "@/components/finance/stat-tile";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { cashflowSeries, netWorthSeries, projectionSeries, spendingByCategory } from "../demo-data";
import { DsSection } from "../section";

const totalSpending = spendingByCategory.reduce((s, c) => s + c.value, 0);

function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          {head.map((h, i) => (
            <TH key={h} align={i === 0 ? "left" : "right"}>{h}</TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={String(r[0])}>
            {r.map((c, i) => (
              <TD key={i} align={i === 0 ? "left" : "right"} className="h-10">
                {typeof c === "number" ? formatCurrency(c) : c}
              </TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function DashboardPreviewSection() {
  return (
    <DsSection
      id="painel"
      eyebrow="Composição"
      title="Prévia do Painel"
      description="Como os componentes se combinam na tela principal. Dados ilustrativos."
    >
      <div className="rounded-2xl bg-canvas p-1 sm:p-2">
        <Badge tone="outline" className="mb-6">Dados ilustrativos</Badge>

        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-end">
          <NetWorthHero netWorth={228750.42} assets={271900} liabilities={43150} change={25.4} />
          <Card>
            <CardHeader title="Inteligência financeira" description="Calculado a partir dos seus lançamentos de setembro" />
            <ul className="divide-y divide-line px-5 sm:px-6">
              <Insight icon={TrendingDown} tone="positive" basis="R$ 9.150 em setembro vs. R$ 10.900 em agosto">
                Você gastou <strong>16% menos</strong> que no mês anterior.
              </Insight>
              <Insight icon={PiggyBank} basis="(receitas − despesas) ÷ receitas">
                Sua taxa de poupança está em <strong>35,6%</strong>.
              </Insight>
              <Insight icon={Shield} tone="warning" basis="R$ 42.000 guardados ÷ custo médio de R$ 10.130">
                Sua reserva cobre aproximadamente <strong>4,1 meses</strong>. Meta: 6.
              </Insight>
            </ul>
          </Card>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Saldo disponível" value={18420.1} icon={Wallet} explainer="Soma das contas correntes, digitais e carteiras. Não inclui investimentos." />
          <StatTile label="Receitas do mês" value={14200} icon={ArrowDownLeft} flow="income" footer={<Delta value={-3.1} suffix="" />} />
          <StatTile label="Despesas do mês" value={9150} icon={ArrowUpRight} footer={<Delta value={-16.1} inverse suffix="" />} />
          <StatTile label="Investimentos" value={186300} icon={TrendingUp} footer={<Delta value={1.2} suffix="no mês" />} />
          <StatTile label="Reserva" value={42000} icon={Shield} footer={<Progress value={42000} max={60780} tone="brass" size="sm" label="Progresso da reserva" />} />
          <StatTile label="Compromissos futuros" value={6870} icon={CalendarClock} explainer="Faturas abertas, parcelas e contas agendadas para os próximos 30 dias." />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Evolução patrimonial"
            takeaway="Seu patrimônio cresceu R$ 46.350 em 12 meses."
            action={
              <Tabs defaultValue="12m">
                <TabsList>
                  <TabsTrigger value="6m">6M</TabsTrigger>
                  <TabsTrigger value="12m">12M</TabsTrigger>
                  <TabsTrigger value="all">Tudo</TabsTrigger>
                </TabsList>
              </Tabs>
            }
            table={<MiniTable head={["Mês", "Patrimônio"]} rows={netWorthSeries.map((r) => [r.month, r.patrimonio])} />}
          >
            <LineChart
              data={netWorthSeries}
              xKey="month"
              domain={["auto", "auto"]}
              series={[{ key: "patrimonio", label: "Patrimônio líquido", color: "var(--brass)" }]}
              ariaLabel="Patrimônio líquido de outubro a setembro, de R$ 182.400 para R$ 228.750"
              height={260}
            />
          </ChartCard>

          <ChartCard
            title="Distribuição de gastos"
            takeaway="Moradia concentra 37% das despesas."
            table={<MiniTable head={["Categoria", "Valor"]} rows={spendingByCategory.map((c) => [c.label, c.value])} />}
          >
            <DonutChart
              data={spendingByCategory}
              ariaLabel="Despesas de setembro por categoria"
              centerValue={formatCurrency(totalSpending, { compact: true })}
              centerLabel="em setembro"
              size={180}
            />
            <ul className="mt-5 space-y-2 px-3">
              {spendingByCategory.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: SERIES[i] }} />
                  <span className="text-ink-2">{c.label}</span>
                  <span className="num ml-auto font-medium text-ink">{formatCurrency(c.value)}</span>
                  <span className="num w-9 text-right text-ink-3">{Math.round((c.value / totalSpending) * 100)}%</span>
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard
            className="lg:col-span-2"
            title="Receitas x despesas"
            takeaway="Em todos os últimos 6 meses você gastou menos do que ganhou."
            legend={[
              { label: "Receitas", color: "var(--positive)" },
              { label: "Despesas", color: "var(--ink-3)" },
            ]}
            table={<MiniTable head={["Mês", "Receitas", "Despesas"]} rows={cashflowSeries.map((r) => [r.month, r.receitas, r.despesas])} />}
          >
            <BarChart
              data={cashflowSeries}
              xKey="month"
              series={[
                { key: "receitas", label: "Receitas", color: "var(--positive)" },
                { key: "despesas", label: "Despesas", color: "var(--ink-3)" },
              ]}
              ariaLabel="Receitas e despesas mensais de abril a setembro"
            />
          </ChartCard>

          <Card>
            <CardHeader title="Meta: Viagem ao Japão" description="Prazo em 8 meses" action={<Badge tone="accent">Alta</Badge>} />
            <CardBody className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="num text-2xl font-semibold text-ink">62,5%</span>
                <span className="num text-xs text-ink-2">R$ 12.500 de R$ 20.000</span>
              </div>
              <Progress value={12500} max={20000} label="Progresso da meta Viagem" />
              <p className="text-xs text-ink-2">
                Guarde <strong className="num font-semibold text-ink">R$ 937,50/mês</strong> para chegar no prazo.
              </p>
            </CardBody>
          </Card>

          <ChartCard
            className="lg:col-span-3"
            title="Projeção de patrimônio"
            takeaway={<span className="inline-flex flex-wrap items-center gap-2">No cenário base, cerca de R$ 621 mil em 2031. <EstimateBadge /></span>}
            legend={[
              { label: "Conservador", color: SERIES[1], dashed: true },
              { label: "Base", color: SERIES[0], dashed: true },
              { label: "Otimista", color: SERIES[2], dashed: true },
            ]}
            table={<MiniTable head={["Ano", "Conservador", "Base", "Otimista"]} rows={projectionSeries.map((r) => [r.year, r.conservador, r.base, r.otimista])} />}
          >
            <LineChart
              data={projectionSeries}
              xKey="year"
              series={[
                { key: "conservador", label: "Conservador", color: SERIES[1], dashed: true },
                { key: "base", label: "Base", color: SERIES[0], dashed: true },
                { key: "otimista", label: "Otimista", color: SERIES[2], dashed: true },
              ]}
              ariaLabel="Projeção de patrimônio de 2026 a 2031 em três cenários"
              height={260}
            />
            <EstimateDisclaimer className="px-3 pt-3" />
          </ChartCard>
        </div>
      </div>
    </DsSection>
  );
}
