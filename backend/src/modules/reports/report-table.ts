export type ReportCell =
  | { t: 'text'; v: string | null }
  | { t: 'money'; v: string }
  | { t: 'date'; v: string | null }
  | { t: 'percent'; v: number | null }
  | { t: 'int'; v: number };

export interface ReportColumn {
  header: string;
  /** Peso relativo da largura no PDF. */
  width?: number;
  align?: 'left' | 'right';
}

/** Tabela neutra usada pelos exportadores CSV e PDF. */
export interface ReportTable {
  kind: string;
  title: string;
  periodLabel: string;
  filters: string[];
  summary: [string, string][];
  columns: ReportColumn[];
  rows: ReportCell[][];
  /** Aviso extra no rodapé (ex.: investimentos). */
  disclaimer?: string;
}

export const text = (v: string | null): ReportCell => ({ t: 'text', v });
export const money = (v: string): ReportCell => ({ t: 'money', v });
export const date = (v: string | null): ReportCell => ({ t: 'date', v });
export const percent = (v: number | null): ReportCell => ({ t: 'percent', v });
export const int = (v: number): ReportCell => ({ t: 'int', v });
