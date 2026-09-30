import type { DateOnly } from '../../../common/utils/date-only.js';
import type { Decimal } from '../../../common/utils/money.js';

/** Uma linha do extrato como veio do banco: valor com sinal (negativo = saiu dinheiro). */
export interface StatementLine {
  date: DateOnly;
  description: string;
  amount: Decimal;
  /** Identificador da linha no banco (FITID do OFX, "Identificador" do CSV do Nubank…). */
  fitId: string | null;
}

export interface ParsedStatement {
  format: 'OFX' | 'CSV';
  /** O que o próprio arquivo diz ser; CSV não informa. */
  kind: 'BANK' | 'CARD' | null;
  lines: StatementLine[];
  /** Saldo final informado pelo banco (OFX: LEDGERBAL). */
  balance: { amount: Decimal; date: DateOnly } | null;
}

/** Arquivo que não conseguimos interpretar; `message` é exibida ao usuário. */
export class StatementParseError extends Error {}
