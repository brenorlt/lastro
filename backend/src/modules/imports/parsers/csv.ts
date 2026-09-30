import { normalizeSearch } from '../../../common/utils/search-text.js';
import {
  type ParsedStatement,
  StatementParseError,
  type StatementLine,
} from './statement.types.js';
import { cleanDescription, parseAmount, parseStatementDate } from './values.js';

const HEADER_SCAN_ROWS = 20;

/** Tokenizador RFC 4180 (aspas duplas, aspas escapadas, quebra de linha dentro de aspas). */
export function tokenizeCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) rows.push([...row, cell]);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

/** O delimitador mais frequente (fora de aspas) nas primeiras linhas. */
function detectDelimiter(text: string): string {
  const sample = text
    .split(/\r?\n/)
    .slice(0, HEADER_SCAN_ROWS)
    .join('\n')
    .replace(/"[^"]*"/g, '');
  const counts = [';', ',', '\t', '|'].map((d) => [d, sample.split(d).length - 1] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

type Role = 'date' | 'description' | 'amount' | 'credit' | 'debit' | 'id';

/** Sinônimos de cabeçalho já normalizados (minúsculas, sem acentos). A ordem define a prioridade. */
const HEADERS: Record<Role, RegExp> = {
  date: /^(data|date|dt)\b/,
  amount: /^(valor|amount|value|quantia)\b(?!.*saldo)/,
  credit: /^(credito|entrada|entradas)\b/,
  debit: /^(debito|saida|saidas)\b/,
  id: /^(identificador|id|codigo|documento|fitid)$/,
  description:
    /^(descricao|description|historico|title|titulo|lancamento|estabelecimento|memo|detalhes?)\b/,
};

type Columns = Partial<Record<Role, number>>;

function mapColumns(header: string[]): Columns | null {
  const names = header.map((h) => normalizeSearch(h));
  const used = new Set<number>();
  const columns: Columns = {};
  for (const role of Object.keys(HEADERS) as Role[]) {
    const index = names.findIndex((n, i) => !used.has(i) && HEADERS[role].test(n));
    if (index >= 0) {
      columns[role] = index;
      used.add(index);
    }
  }
  const hasValue = columns.amount !== undefined || (columns.credit ?? columns.debit) !== undefined;
  if (columns.date === undefined || !hasValue) return null;
  if (columns.description === undefined) {
    // Sem cabeçalho conhecido para a descrição: usa a primeira coluna de texto restante.
    const rest = names.findIndex((n, i) => !used.has(i) && !/saldo|categoria|parcela/.test(n));
    if (rest >= 0) columns.description = rest;
  }
  return columns;
}

const BALANCE_ROW = /^saldo\b|saldo (anterior|do dia|final|disponivel)/;

/**
 * CSV exportado por bancos (Nubank, Inter, Itaú, C6…). Detecta delimitador e cabeçalho (que pode
 * vir depois de linhas de preâmbulo) por sinônimos; valor único com sinal ou colunas separadas
 * de crédito e débito. Linhas de saldo são ignoradas.
 */
export function parseCsv(text: string): ParsedStatement {
  const rows = tokenizeCsv(text, detectDelimiter(text));
  let headerIndex = -1;
  let columns: Columns | null = null;
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
    columns = mapColumns(rows[i]);
    if (columns) {
      headerIndex = i;
      break;
    }
  }
  if (!columns) {
    throw new StatementParseError(
      'Não encontramos as colunas de data e valor. O CSV precisa de um cabeçalho como "Data;Descrição;Valor"',
    );
  }

  const cell = (row: string[], role: Role) => {
    const index = columns[role];
    return index === undefined ? '' : (row[index] ?? '');
  };

  const lines: StatementLine[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const date = parseStatementDate(cell(row, 'date'));
    if (!date) continue;
    const description = cleanDescription(cell(row, 'description'));
    if (BALANCE_ROW.test(normalizeSearch(description))) continue;

    let amount = columns.amount !== undefined ? parseAmount(cell(row, 'amount')) : null;
    if (columns.amount === undefined) {
      const credit = parseAmount(cell(row, 'credit'));
      const debit = parseAmount(cell(row, 'debit'));
      if (credit && !credit.isZero()) amount = credit.abs();
      else if (debit && !debit.isZero()) amount = debit.abs().negated();
    }
    if (!amount || amount.isZero()) continue;

    lines.push({
      date,
      amount,
      description: description || 'Lançamento importado',
      fitId: cell(row, 'id') || null,
    });
  }

  const fitIds = lines.map((l) => l.fitId).filter(Boolean);
  if (new Set(fitIds).size !== fitIds.length) for (const l of lines) l.fitId = null;

  return { format: 'CSV', kind: null, lines, balance: null };
}
