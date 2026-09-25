"use client";

/*
 * Primitivos de gráfico sobre Recharts. Regras (docs/DESIGN_SYSTEM.md › Gráficos):
 * - um eixo Y por gráfico; grade recessiva; linhas de 2px; barras com topo arredondado de 4px;
 * - cores por papel (var(--*)), atribuídas em ordem fixa e seguindo a entidade;
 * - hover com tooltip sempre; projeções em linha tracejada.
 */

import {
  Area,
  AreaChart as RArea,
  Bar,
  BarChart as RBar,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RLine,
  Pie,
  PieChart as RPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import { formatCurrency } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
] as const;

export interface SeriesDef<K extends string> {
  key: K;
  label: string;
  color: string;
  dashed?: boolean;
}

type Row = Record<string, string | number>;

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--ink-3)", fontSize: 12 },
} as const;

const compact = (v: number) => formatCurrency(v, { compact: true });

interface CartesianProps<K extends string> {
  data: Row[];
  xKey: string;
  series: SeriesDef<K>[];
  height?: number;
  /** Descrição textual para leitores de tela. */
  ariaLabel: string;
  valueFormatter?: (v: number) => string;
  /** Linhas podem usar domínio automático; áreas e barras sempre partem do zero. */
  domain?: [number | "auto" | "dataMin", number | "auto" | "dataMax"];
}

export function AreaChart<K extends string>({ data, xKey, series, height = 240, ariaLabel, valueFormatter }: CartesianProps<K>) {
  const id = useId().replace(/:/g, "");
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RArea data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} {...axisProps} dy={8} minTickGap={16} />
          <YAxis {...axisProps} width={64} tickFormatter={compact} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} valueFormatter={valueFormatter} />}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              fill={s.dashed ? "transparent" : `url(#${id}-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </RArea>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart<K extends string>({ data, xKey, series, height = 240, ariaLabel, valueFormatter }: CartesianProps<K>) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBar data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} {...axisProps} dy={8} />
          <YAxis {...axisProps} width={64} tickFormatter={compact} />
          <Tooltip
            cursor={{ fill: "var(--surface-sunken)" }}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} valueFormatter={valueFormatter} />}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
          ))}
        </RBar>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart<K extends string>({ data, xKey, series, height = 240, ariaLabel, valueFormatter, domain }: CartesianProps<K>) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLine data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} {...axisProps} dy={8} minTickGap={16} />
          <YAxis {...axisProps} width={64} tickFormatter={compact} domain={domain ?? [0, "auto"]} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} valueFormatter={valueFormatter} />}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={false}
            />
          ))}
        </RLine>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutSlice {
  /** Identificador estável da fatia (ex.: categoryId). Usado como key — o label pode se repetir. */
  id: string;
  label: string;
  value: number;
}

/** Distribuição (até 6 fatias + "Outros"). Sempre acompanhada da legenda com valores. */
export function DonutChart({ data, ariaLabel, centerLabel, centerValue, size = 200, colors }: {
  data: DonutSlice[];
  /** Cores por fatia (ex.: cor da categoria). Padrão: paleta categórica em ordem fixa. */
  colors?: string[];
  ariaLabel: string;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RPie>
          <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload} />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={1.5}
            cornerRadius={4}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={d.id} fill={colors?.[i] ?? SERIES[i % SERIES.length]} />
            ))}
          </Pie>
        </RPie>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="num text-lg font-semibold text-ink">{centerValue}</span>}
          {centerLabel && <span className="text-2xs text-ink-3">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/** Tendência mínima para tiles. Sem eixos; decorativa — o número ao lado carrega a informação. */
export function Sparkline({ data, color = "var(--ink-3)", height = 36 }: { data: number[]; color?: string; height?: number }) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div aria-hidden style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLine data={rows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </RLine>
      </ResponsiveContainer>
    </div>
  );
}
