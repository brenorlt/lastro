import type { ReportCell, ReportTable } from './report-table.js';

const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

/** "1234.5" → "1234,50" (sem separador de milhar, amigável a planilhas). */
export function csvMoney(value: string): string {
  const [int, dec = ''] = value.split('.');
  return `${int},${dec.padEnd(2, '0').slice(0, 2)}`;
}

export function csvDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

/** Aspas quando necessário e neutralização de fórmulas (CSV injection) em textos livres. */
export function escapeCsvText(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function formatCsvCell(cell: ReportCell): string {
  switch (cell.t) {
    case 'money':
      return csvMoney(cell.v);
    case 'date':
      return cell.v ? csvDate(cell.v) : '';
    case 'percent':
      return cell.v === null ? '' : String(cell.v).replace('.', ',');
    case 'int':
      return String(cell.v);
    case 'text':
      return escapeCsvText(cell.v ?? '');
  }
}

/** CSV pt-BR: UTF-8 com BOM, separador ";", vírgula decimal, datas dd/mm/aaaa, CRLF. */
export function buildCsv(table: Pick<ReportTable, 'columns' | 'rows'>): string {
  const lines = [
    table.columns.map((c) => escapeCsvText(c.header)).join(';'),
    ...table.rows.map((row) => row.map(formatCsvCell).join(';')),
  ];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
