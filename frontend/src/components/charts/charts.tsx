"use client";

/*
 * API pública dos gráficos (regras em docs/DESIGN_SYSTEM.md › Gráficos; implementação em
 * ./charts-recharts). O Recharts pesa ~120 KB gzip: aqui ele vira um pedaço de JS separado,
 * então a página aparece e busca os dados sem esperar por ele. Enquanto carrega, cada gráfico
 * mostra um esqueleto do mesmo tamanho (sem pulo de layout).
 */

import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import type { CartesianProps, DonutChartProps, SparklineProps } from "./chart-types";

export { SERIES } from "./chart-types";
export type { DonutSlice, SeriesDef } from "./chart-types";

const load = () => import("./charts-recharts");

// Começa a baixar assim que uma tela com gráfico é carregada, em paralelo com a sessão e os dados:
// quando os números chegarem, o gráfico em geral já está pronto para desenhar.
if (typeof window !== "undefined") void load();

const LazyArea = lazy(() => load().then((m) => ({ default: m.AreaChart })));
const LazyBar = lazy(() => load().then((m) => ({ default: m.BarChart })));
const LazyLine = lazy(() => load().then((m) => ({ default: m.LineChart })));
const LazyDonut = lazy(() => load().then((m) => ({ default: m.DonutChart })));
const LazySparkline = lazy(() => load().then((m) => ({ default: m.Sparkline })));

function Placeholder({ height }: { height: number }) {
  return <Skeleton className="w-full rounded-md" style={{ height }} />;
}

export function AreaChart<K extends string>(props: CartesianProps<K>) {
  return (
    <Suspense fallback={<Placeholder height={props.height ?? 240} />}>
      <LazyArea {...props} />
    </Suspense>
  );
}

export function BarChart<K extends string>(props: CartesianProps<K>) {
  return (
    <Suspense fallback={<Placeholder height={props.height ?? 240} />}>
      <LazyBar {...props} />
    </Suspense>
  );
}

export function LineChart<K extends string>(props: CartesianProps<K>) {
  return (
    <Suspense fallback={<Placeholder height={props.height ?? 240} />}>
      <LazyLine {...props} />
    </Suspense>
  );
}

export function DonutChart(props: DonutChartProps) {
  const size = props.size ?? 200;
  return (
    <Suspense fallback={<Skeleton className="mx-auto rounded-full" style={{ width: size, height: size }} />}>
      <LazyDonut {...props} />
    </Suspense>
  );
}

export function Sparkline(props: SparklineProps) {
  return (
    <Suspense fallback={<div aria-hidden style={{ height: props.height ?? 36 }} />}>
      <LazySparkline {...props} />
    </Suspense>
  );
}
