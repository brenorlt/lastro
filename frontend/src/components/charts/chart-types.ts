/* Tipos e paleta dos gráficos, sem Recharts: podem ser importados sem custo de JS. */

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

export type Row = Record<string, string | number>;

export interface CartesianProps<K extends string> {
  data: Row[];
  xKey: string;
  series: SeriesDef<K>[];
  height?: number;
  /** Descrição textual para leitores de tela. */
  ariaLabel: string;
  valueFormatter?: (v: number) => string;
  /** Linhas podem usar domínio automático; áreas e barras sempre partem do zero. */
  domain?: [number | "auto" | "dataMin", number | "auto" | "dataMax"];
  /** Formata os rótulos do eixo Y. Padrão: moeda compacta (a maioria dos gráficos é monetária). */
  yTickFormatter?: (v: number) => string;
  /** false para séries de contagem (evita ticks fracionários tipo "0,5"). Padrão: true (moeda). */
  yAllowDecimals?: boolean;
}

export interface DonutSlice {
  /** Identificador estável da fatia (ex.: categoryId). Usado como key — o label pode se repetir. */
  id: string;
  label: string;
  value: number;
}

export interface DonutChartProps {
  data: DonutSlice[];
  /** Cores por fatia (ex.: cor da categoria). Padrão: paleta categórica em ordem fixa. */
  colors?: string[];
  ariaLabel: string;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

export interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}
