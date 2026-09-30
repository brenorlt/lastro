import { createHash } from 'node:crypto';
import type { DateOnly } from '../../common/utils/date-only.js';
import type { Decimal } from '../../common/utils/money.js';
import { merchantKey } from './categorize.js';
import type { ParsedStatement, StatementLine } from './parsers/statement.types.js';

export type TargetKind = 'ACCOUNT' | 'CARD';
export type PreviewStatus = 'NEW' | 'DUPLICATE' | 'IMPORTED' | 'UNSUPPORTED';

/** O banco pode registrar a data de compensação até alguns dias depois da que o usuário lançou. */
export const DUPLICATE_WINDOW_DAYS = 3;

/** Lançamento já existente na conta/cartão, com sinal do ponto de vista do extrato. */
export interface ExistingEntry {
  date: DateOnly;
  signed: Decimal;
  externalId: string | null;
}

export interface PreviewRow {
  externalId: string;
  date: DateOnly;
  description: string;
  /** Sempre positivo, 2 casas. */
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  status: PreviewStatus;
  reason: string | null;
  categoryId: string | null;
}

/**
 * Identidade estável da linha do extrato dentro da conta/cartão de destino: o FITID do banco
 * quando confiável, senão data + valor + estabelecimento + ordem entre linhas idênticas do mesmo
 * arquivo (dois cafés iguais no mesmo dia continuam sendo dois lançamentos).
 */
export function lineExternalId(
  targetKind: TargetKind,
  targetId: string,
  line: StatementLine,
  occurrence: number,
): string {
  const identity = line.fitId
    ? `fit:${line.fitId}`
    : `${line.date}|${line.amount.toFixed(2)}|${merchantKey(line.description)}|${occurrence}`;
  return createHash('sha256')
    .update(`${targetKind}:${targetId.toLowerCase()}:${identity}`)
    .digest('hex');
}

/** `lineExternalId` de cada linha, contando a ordem entre linhas idênticas do arquivo. */
export function lineExternalIds(
  targetKind: TargetKind,
  targetId: string,
  lines: StatementLine[],
): string[] {
  const occurrences = new Map<string, number>();
  return lines.map((line) => {
    const key = `${line.date}|${line.amount.toFixed(2)}|${merchantKey(line.description)}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return lineExternalId(targetKind, targetId, line, occurrence);
  });
}

/**
 * Em CSV de cartão, alguns bancos (ex.: Nubank) exportam compras como valores positivos. Se a
 * maioria das linhas é positiva, invertemos para a convenção do extrato (compra = negativo).
 */
export function autoInvert(targetKind: TargetKind, parsed: ParsedStatement): boolean {
  if (targetKind !== 'CARD' || parsed.format !== 'CSV') return false;
  const positives = parsed.lines.filter((l) => l.amount.isPositive()).length;
  return positives > parsed.lines.length - positives;
}

function daysBetween(a: DateOnly, b: DateOnly): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

export function buildPreview(input: {
  targetKind: TargetKind;
  targetId: string;
  lines: StatementLine[];
  invert: boolean;
  existing: ExistingEntry[];
  suggest: (description: string, type: 'INCOME' | 'EXPENSE') => string | null;
}): PreviewRow[] {
  const ids = lineExternalIds(input.targetKind, input.targetId, input.lines);
  const fileIds = new Set(ids);
  const importedIds = new Set(
    input.existing
      .map((e) => e.externalId)
      .filter((id): id is string => id !== null && fileIds.has(id)),
  );
  // Candidatos a duplicata: o que existe e não é a importação anterior de uma linha deste arquivo.
  const pool = new Map<string, DateOnly[]>();
  for (const e of input.existing) {
    if (e.externalId && importedIds.has(e.externalId)) continue;
    const key = e.signed.toFixed(2);
    pool.set(key, [...(pool.get(key) ?? []), e.date]);
  }

  const rows: PreviewRow[] = [];
  for (const [index, line] of input.lines.entries()) {
    const externalId = ids[index];

    const signed = input.invert ? line.amount.negated() : line.amount;
    const type = signed.isNegative() ? 'EXPENSE' : 'INCOME';
    const base = {
      externalId,
      date: line.date,
      description: line.description,
      amount: signed.abs().toFixed(2),
      type,
    } as const;

    if (importedIds.has(externalId)) {
      rows.push({ ...base, status: 'IMPORTED', reason: 'Já importado antes', categoryId: null });
      continue;
    }
    if (input.targetKind === 'CARD' && type === 'INCOME') {
      rows.push({
        ...base,
        status: 'UNSUPPORTED',
        reason: 'Pagamento de fatura ou estorno: registre o pagamento pela tela do cartão',
        categoryId: null,
      });
      continue;
    }

    // Consome o candidato mais próximo em data, para que cada existente case com uma linha só.
    const candidates = pool.get(signed.toFixed(2)) ?? [];
    let best = -1;
    for (const [i, date] of candidates.entries()) {
      const distance = daysBetween(date, line.date);
      if (
        distance <= DUPLICATE_WINDOW_DAYS &&
        (best < 0 || distance < daysBetween(candidates[best], line.date))
      ) {
        best = i;
      }
    }
    const categoryId = input.suggest(line.description, type);
    if (best >= 0) {
      candidates.splice(best, 1);
      rows.push({ ...base, status: 'DUPLICATE', reason: 'Parece já estar lançado', categoryId });
    } else {
      rows.push({ ...base, status: 'NEW', reason: null, categoryId });
    }
  }
  // Mais recentes primeiro, como na lista de lançamentos (sort é estável).
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
