import type { DateOnly, YearMonth } from '../../common/utils/date-only.js';
import { monthEnd } from '../../common/utils/date-only.js';
import { Decimal } from '../../common/utils/money.js';
import type { InvestmentTransactionType } from '../../generated/prisma/enums.js';

export interface PositionState {
  quantity: Decimal | null;
  averagePrice: Decimal | null;
  investedAmount: Decimal;
  currentValue: Decimal;
  income: Decimal;
  realizedGain: Decimal;
  lastValuationAt: DateOnly | null;
}

export interface EngineTx {
  type: InvestmentTransactionType;
  amount: Decimal;
  quantity: Decimal | null;
  date: DateOnly;
  /** Desempate estável para mesma data. */
  createdAt?: Date;
}

export class InsufficientPositionError extends Error {}

export const EMPTY_POSITION: PositionState = {
  quantity: null,
  averagePrice: null,
  investedAmount: new Decimal(0),
  currentValue: new Decimal(0),
  income: new Decimal(0),
  realizedGain: new Decimal(0),
  lastValuationAt: null,
};

const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Aplica uma movimentação à posição (função pura). */
export function applyInvestmentTx(state: PositionState, tx: EngineTx): PositionState {
  const next = { ...state };
  switch (tx.type) {
    case 'BUY': {
      next.investedAmount = state.investedAmount.plus(tx.amount);
      next.currentValue = state.currentValue.plus(tx.amount);
      if (tx.quantity?.greaterThan(0)) {
        next.quantity = (state.quantity ?? new Decimal(0)).plus(tx.quantity);
        // Preço médio ponderado = custo total ÷ cotas.
        next.averagePrice = next.investedAmount
          .div(next.quantity)
          .toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
      }
      return next;
    }
    case 'SELL': {
      let fraction: Decimal;
      if (tx.quantity?.greaterThan(0) && state.quantity?.greaterThan(0)) {
        if (tx.quantity.greaterThan(state.quantity)) throw new InsufficientPositionError();
        fraction = tx.quantity.div(state.quantity);
        next.quantity = state.quantity.minus(tx.quantity);
        if (next.quantity.isZero()) next.averagePrice = null;
      } else {
        if (state.currentValue.lessThanOrEqualTo(0) || tx.amount.greaterThan(state.currentValue)) {
          throw new InsufficientPositionError();
        }
        fraction = tx.amount.div(state.currentValue);
      }
      const costReduced = money(state.investedAmount.times(fraction));
      next.investedAmount = state.investedAmount.minus(costReduced);
      next.realizedGain = state.realizedGain.plus(tx.amount.minus(costReduced));
      next.currentValue = Decimal.max(state.currentValue.minus(tx.amount), 0);
      return next;
    }
    case 'DIVIDEND':
    case 'INTEREST':
      next.income = state.income.plus(tx.amount);
      return next;
    case 'FEE':
      next.income = state.income.minus(tx.amount);
      return next;
    case 'VALUATION':
      next.currentValue = tx.amount;
      next.lastValuationAt = tx.date;
      return next;
  }
}

export function sortTxs<T extends EngineTx>(txs: T[]): T[] {
  return [...txs].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
}

/** Reexecuta todas as movimentações em ordem de data (lança InsufficientPositionError). */
export function replay(txs: EngineTx[], until?: DateOnly): PositionState {
  let state = EMPTY_POSITION;
  for (const tx of sortTxs(txs)) {
    if (until && tx.date > until) break;
    state = applyInvestmentTx(state, tx);
  }
  return state;
}

/** profit = atual − investido + rendimentos + ganho realizado. */
export function profitOf(
  state: Pick<PositionState, 'currentValue' | 'investedAmount' | 'income' | 'realizedGain'>,
) {
  const profit = state.currentValue
    .minus(state.investedAmount)
    .plus(state.income)
    .plus(state.realizedGain);
  const percent = state.investedAmount.greaterThan(0)
    ? Number(
        profit
          .div(state.investedAmount)
          .times(100)
          .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
          .toFixed(1),
      )
    : null;
  return { profit, profitPercent: percent };
}

/** Valor e custo ao fim de cada mês + aportes líquidos (BUY − SELL) no mês. */
export function monthlySeries(txs: EngineTx[], months: YearMonth[]) {
  return months.map((month) => {
    const state = replay(txs, monthEnd(month));
    const contributions = txs
      .filter((t) => t.date.startsWith(month))
      .reduce(
        (acc, t) =>
          t.type === 'BUY' ? acc.plus(t.amount) : t.type === 'SELL' ? acc.minus(t.amount) : acc,
        new Decimal(0),
      );
    return { month, value: state.currentValue, invested: state.investedAmount, contributions };
  });
}
