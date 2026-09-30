import { type DateOnly, isValidDateOnly } from '../../../common/utils/date-only.js';
import { Decimal } from '../../../common/utils/money.js';

/**
 * Bancos brasileiros exportam em UTF-8 ou Windows-1252 (o OFX declara CHARSET:1252). Tenta UTF-8
 * estrito e cai para 1252 se houver byte inválido.
 */
export function decodeStatement(buffer: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.replace(/^\uFEFF/, '');
}

/**
 * Valor monetário em formato brasileiro ou americano: "1.234,56", "-1234.56", "R$ 12,50",
 * "(12,50)", "12,50 D". Com os dois separadores, o último é o decimal; só vírgula é decimal;
 * só ponto em grupos de 3 ("1.234.567") é milhar. Retorna null se não for um valor.
 */
export function parseAmount(raw: string): Decimal | null {
  let value = raw.trim().replace(/\s+/g, '').replace(/^R\$/i, '').replace(/R\$/i, '');
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  const suffix = /([DC])$/i.exec(value);
  if (suffix) {
    negative = suffix[1].toUpperCase() === 'D';
    value = value.slice(0, -1);
  }
  if (value.endsWith('-')) {
    negative = true;
    value = value.slice(0, -1);
  }
  if (value.startsWith('-')) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }
  if (!/^[\d.,]+$/.test(value) || !/\d/.test(value)) return null;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    normalized = value.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    if (value.indexOf(',') !== lastComma) return null;
    normalized = value.replace(',', '.');
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3}){2,}$/.test(value)) {
    normalized = value.split('.').join('');
  } else {
    if (value.indexOf('.') !== lastDot) return null;
    normalized = value;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const amount = new Decimal(normalized).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return negative ? amount.negated() : amount;
}

/** Datas "DD/MM/AAAA", "DD/MM/AA", "DD-MM-AAAA", "AAAA-MM-DD" e "AAAAMMDD" (OFX). */
export function parseStatementDate(raw: string): DateOnly | null {
  const value = raw.trim();
  let year: number, month: number, day: number;
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value);
  if (m) {
    [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value.split(/\s/)[0]))) {
    [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (year < 100) year += 2000;
  } else {
    return null;
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidDateOnly(iso) ? iso : null;
}

/** Espaços colapsados e limite da coluna `description` (255). */
export function cleanDescription(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 255);
}
