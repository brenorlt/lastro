"use client";

import { Flag, Info, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart } from "@/components/charts/charts";
import { ChartCard } from "@/components/charts/chart-card";
import { EstimateBadge, EstimateDisclaimer } from "@/components/finance/estimate-note";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SliderField } from "@/components/ui/slider-field";
import { ErrorState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { usePlanningAssumptions, usePlanningBaseline, saveAssumptions } from "@/features/net-worth/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/cn";
import { formatCurrency, toNumber } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { applyScenario, DEFAULT_ASSUMPTIONS, depletionYear, independenceYear, project, SCENARIOS, type Assumptions, type ScenarioKey } from "../projection";

const SCENARIO_COLORS: Record<ScenarioKey, string> = { conservative: "var(--series-2)", base: "var(--series-1)", optimistic: "var(--series-3)" };
const HORIZONS = [5, 10, 15, 20, 25, 30];

function Assumptionsform({ a, set, surplus }: { a: Assumptions; set: (p: Partial<Assumptions>) => void; surplus: number }) {
  const auto = a.monthlyContribution === null;
  return (
    <Card>
      <CardHeader title="Premissas" description="Ajuste e veja o impacto na hora. O cenário base usa exatamente estes valores." action={<Button variant="ghost" size="sm" onClick={() => set(DEFAULT_ASSUMPTIONS)}><RotateCcw aria-hidden /> Padrão</Button>} />
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="horizon">Horizonte</Label>
          <Select value={String(a.horizonYears)} onValueChange={(v) => set({ horizonYears: Number(v) })}>
            <SelectTrigger id="horizon"><SelectValue /></SelectTrigger>
            <SelectContent>{HORIZONS.map((h) => <SelectItem key={h} value={String(h)}>{h} anos</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>Aporte mensal</Label>
            <label className="flex items-center gap-2 text-xs text-ink-2">
              Usar minha sobra
              <Switch checked={auto} onCheckedChange={(v) => set({ monthlyContribution: v ? null : Math.max(0, Math.round(surplus)) })} aria-label="Usar a sobra mensal como aporte" />
            </label>
          </div>
          {auto ? (
            <p className="rounded-md bg-surface-sunken px-3 py-2.5 text-xs text-ink-2">
              Renda − despesas de cada ano. Hoje: <strong className="num font-semibold text-ink">{formatCurrency(surplus)}/mês</strong>, crescendo com as taxas abaixo.
            </p>
          ) : (
            <MoneyInput aria-label="Aporte mensal fixo" value={String(a.monthlyContribution ?? 0)} onChange={(v) => set({ monthlyContribution: v === "" || v === "invalid" ? 0 : Number(v) })} />
          )}
        </div>
        <SliderField label="Rentabilidade anual" value={a.annualReturn} onChange={(v) => set({ annualReturn: v })} min={-5} max={20} hint="Retorno nominal médio esperado da carteira." />
        <SliderField label="Crescimento da renda" value={a.incomeGrowth} onChange={(v) => set({ incomeGrowth: v })} min={-5} max={15} hint="Reajustes e promoções, por ano." />
        <SliderField label="Crescimento das despesas" value={a.expenseGrowth} onChange={(v) => set({ expenseGrowth: v })} min={-5} max={15} />
        <SliderField label="Inflação" value={a.inflation} onChange={(v) => set({ inflation: v })} min={0} max={15} hint="Usada para mostrar valores em moeda de hoje." />
      </CardBody>
    </Card>
  );
}

export function PlanningView() {
  const baseline = usePlanningBaseline();
  const saved = usePlanningAssumptions();
  const [draft, setDraft] = useState<Assumptions | null>(null);
  const [real, setReal] = useState(false);
  const a = draft ?? saved.data ?? DEFAULT_ASSUMPTIONS;
  const set = (p: Partial<Assumptions>) => setDraft({ ...a, ...p });

  // Persiste as premissas (sem bloquear a interação).
  const debounced = useDebouncedValue(draft, 800);
  const lastSaved = useRef<string>("");
  useEffect(() => {
    if (!debounced) return;
    const key = JSON.stringify(debounced);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    void saveAssumptions(debounced).catch(() => undefined);
  }, [debounced]);

  const b = baseline.data;
  const base = useMemo(
    () => (b ? { startWealth: toNumber(b.netWorth), monthlyIncome: toNumber(b.averageMonthlyIncome), monthlyExpense: toNumber(b.averageMonthlyExpense) } : null),
    [b],
  );
  const runs = useMemo(
    () => (base ? SCENARIOS.map((s) => ({ ...s, points: project(base, applyScenario(a, s.key)) })) : []),
    [base, a],
  );

  if (baseline.isPending || saved.isPending) {
    return <div className="space-y-4" aria-busy="true"><Skeleton className="h-8 w-48" /><div className="grid gap-4 lg:grid-cols-[22rem_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div></div>;
  }
  if (baseline.isError || !b || !base) return <Card><ErrorState description={userMessage(baseline.error)} onRetry={() => void baseline.refetch()} /></Card>;

  const value = (p: { wealth: number; realWealth: number }) => (real ? p.realWealth : p.wealth);
  const chartRows = runs[0]!.points.map((p, i) => ({
    ano: String(p.year),
    conservative: value(runs[0]!.points[i]!),
    base: value(runs[1]!.points[i]!),
    optimistic: value(runs[2]!.points[i]!),
  }));
  const baseRun = runs[1]!;
  const baseFinal = baseRun.points.at(-1)!;
  const fi = independenceYear(baseRun.points);
  const baseOut = depletionYear(baseRun.points);

  return (
    <>
      <PageHeader
        title="Projeções"
        description={<span className="inline-flex flex-wrap items-center gap-2">Para onde seu patrimônio pode ir, em três cenários. <EstimateBadge /></span>}
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Projeções" }]}
      />

      {b.dataQuality !== "ACTUAL" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          {b.dataQuality === "ONBOARDING"
            ? "Renda e despesas vêm das respostas do onboarding. Com alguns meses de lançamentos, a projeção passa a usar seus números reais."
            : "Ainda não há renda e despesas registradas. Registre lançamentos ou faça o onboarding para uma projeção útil."}
        </div>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Patrimônio hoje", b.netWorth],
          ["Renda média", b.averageMonthlyIncome],
          ["Gasto médio", b.averageMonthlyExpense],
          ["Sobra média", b.averageMonthlySurplus],
        ].map(([label, v]) => (
          <Card key={label} className="p-4">
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className={cn("num mt-1 text-lg font-semibold", toNumber(v!) < 0 ? "text-negative" : "text-ink")}>{formatCurrency(v!)}</dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        <Assumptionsform a={a} set={set} surplus={toNumber(b.averageMonthlySurplus)} />

        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-3">
            {runs.map((r) => {
              const final = r.points.at(-1)!;
              const out = depletionYear(r.points);
              return (
                <li key={r.key}>
                  <Card className={cn("p-4", r.key === "base" && "ring-2 ring-accent")}>
                    <p className="flex items-center gap-2 text-xs text-ink-3">
                      <span aria-hidden className="h-0.5 w-3 border-t-2 border-dashed" style={{ borderColor: SCENARIO_COLORS[r.key] }} />
                      {r.label}
                    </p>
                    <p className="num mt-1 text-xl font-semibold tracking-tight text-ink">{formatCurrency(value(final), { compact: true })}</p>
                    <p className="text-2xs text-ink-3">em {final.year} · rentab. {applyScenario(a, r.key).annualReturn.toLocaleString("pt-BR")}% a.a.</p>
                    {out && <p className="mt-1 text-2xs font-medium text-negative">Patrimônio acaba até {out.year}</p>}
                  </Card>
                </li>
              );
            })}
          </ul>

          <ChartCard
            title="Projeção de patrimônio"
            takeaway={
              baseOut
                ? `No cenário base, as despesas passam a renda e o patrimônio acaba até ${baseOut.year}. Abaixo de zero, a linha mostra o que faltaria para cobrir as despesas.`
                : `No cenário base, cerca de ${formatCurrency(value(baseFinal), { compact: true })} em ${baseFinal.year}${real ? " (em valores de hoje)" : ""}.`
            }
            legend={runs.map((r) => ({ label: r.label, color: SCENARIO_COLORS[r.key], dashed: true }))}
            action={
              <label className="mr-1 flex items-center gap-2 text-xs text-ink-2">
                Valores de hoje
                <Switch checked={real} onCheckedChange={setReal} aria-label="Mostrar em valores de hoje, descontada a inflação" />
              </label>
            }
            table={
              <Table>
                <THead><TR className="hover:bg-transparent"><TH>Ano</TH><TH align="right">Aportado</TH><TH align="right">Rendimentos</TH><TH align="right">Patrimônio (base)</TH></TR></THead>
                <TBody>
                  {baseRun.points.map((p) => (
                    <TR key={p.year}><TD className="h-10">{p.year}</TD><TD align="right" className="h-10">{formatCurrency(p.contributed)}</TD><TD align="right" className="h-10">{formatCurrency(p.returns)}</TD><TD align="right" className="h-10">{formatCurrency(value(p))}</TD></TR>
                  ))}
                </TBody>
              </Table>
            }
          >
            <LineChart
              data={chartRows}
              xKey="ano"
              domain={["auto", "auto"]}
              series={runs.map((r) => ({ key: r.key, label: r.label, color: SCENARIO_COLORS[r.key], dashed: true }))}
              ariaLabel={`Projeção de patrimônio de ${chartRows[0]?.ano} a ${chartRows.at(-1)?.ano} em três cenários`}
              height={300}
            />
            <EstimateDisclaimer className="px-3 pt-3" />
          </ChartCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs text-ink-3">Composição no cenário base</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-2">Patrimônio de hoje</span><span className="num font-medium text-ink">{formatCurrency(base.startWealth)}</span></div>
                <div className="flex justify-between">
                  {/* Sobra negativa sai do patrimônio: aí não é aporte, é retirada. */}
                  <span className="text-ink-2">{baseFinal.contributed < 0 ? "Retiradas para cobrir despesas" : "Aportes no período"}</span>
                  <span className={cn("num font-medium", baseFinal.contributed < 0 ? "text-negative" : "text-ink")}>{formatCurrency(baseFinal.contributed)}</span>
                </div>
                <div className="flex justify-between"><span className="text-ink-2">Rendimentos estimados</span><span className="num font-medium text-ink">{formatCurrency(baseFinal.returns)}</span></div>
              </div>
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-xs text-ink-3"><Flag className="size-3.5" aria-hidden /> Independência financeira</p>
              {fi ? (
                <p className="mt-2 text-sm text-ink-2">
                  Pela regra dos 4%, seu patrimônio poderia cobrir suas despesas a partir de <strong className="font-semibold text-ink">{fi.year}</strong> — em {fi.offset} {fi.offset === 1 ? "ano" : "anos"}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-2">Não alcançada neste horizonte. Aumentar o aporte ou o prazo muda esse cenário.</p>
              )}
              <p className="mt-2 text-2xs text-ink-3">A regra dos 4% é uma referência educativa, não uma garantia.</p>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
