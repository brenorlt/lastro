import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';

/**
 * Utilitários monetários sobre Prisma.Decimal (decimal.js).
 * Nunca use `number` para somar/multiplicar dinheiro: aceite strings ("1234.56")
 * vindas da API e converta para Decimal na borda.
 */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export type MoneyInput = Prisma.Decimal | string | number;

export const MONEY_SCALE = 2;
export const QUANTITY_SCALE = 8;
const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;
const MONEY_STRING = /^-?\d+(\.\d+)?$/;

export function toDecimal(value: MoneyInput): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(value)) return new Prisma.Decimal(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new AppException(ErrorCode.INVALID_AMOUNT);
    // String(n) usa a menor representação que ida-e-volta, evitando 0.1+0.2.
    return new Prisma.Decimal(String(value));
  }
  const normalized = value.trim();
  if (!MONEY_STRING.test(normalized)) throw new AppException(ErrorCode.INVALID_AMOUNT);
  return new Prisma.Decimal(normalized);
}

/** Arredonda para centavos (half-up). */
export function roundMoney(value: MoneyInput): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(MONEY_SCALE, ROUNDING);
}

export function addMoney(...values: MoneyInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(toDecimal(v)), new Prisma.Decimal(0));
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): Prisma.Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function multiplyMoney(a: MoneyInput, factor: MoneyInput): Prisma.Decimal {
  return roundMoney(toDecimal(a).times(toDecimal(factor)));
}

/** Percentual (0–100+) de `part` sobre `total`, com 2 casas. Total zero → 0. */
export function percentageOf(part: MoneyInput, total: MoneyInput): Prisma.Decimal {
  const t = toDecimal(total);
  if (t.isZero()) return new Prisma.Decimal(0);
  return toDecimal(part).div(t).times(100).toDecimalPlaces(2, ROUNDING);
}

/**
 * Divide um valor em N parcelas em centavos exatos; a diferença de arredondamento
 * vai para a primeira parcela (convenção de faturas de cartão).
 */
export function splitInstallments(total: MoneyInput, count: number): Prisma.Decimal[] {
  if (!Number.isInteger(count) || count < 1) throw new AppException(ErrorCode.INVALID_AMOUNT);
  const amount = roundMoney(total);
  const base = amount.div(count).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_DOWN);
  const remainder = amount.minus(base.times(count));
  return Array.from({ length: count }, (_, i) => (i === 0 ? base.plus(remainder) : base));
}

export function isPositiveMoney(value: MoneyInput): boolean {
  return toDecimal(value).greaterThan(0);
}

/** Serialização canônica para a API: string com 2 casas ("1234.50"). */
export function toMoneyString(value: MoneyInput): string {
  return roundMoney(value).toFixed(MONEY_SCALE);
}

/** Formatação para exibição (ex.: "R$ 1.234,50"). */
export function formatMoney(value: MoneyInput, currency = 'BRL', locale = 'pt-BR'): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  // Intl aceita string decimal sem perder precisão (ES2023).
  return formatter.format(toMoneyString(value) as `${number}`).replace(/\u00a0/g, ' ');
}

/** Converte valores vindos de SQL cru (Decimal, string, number, bigint, null) em Decimal. */
export function decimalFrom(value: unknown): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(value)) return new Prisma.Decimal(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return new Prisma.Decimal(value.toString());
  }
  return new Prisma.Decimal(0);
}
