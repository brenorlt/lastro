import { Decimal } from '../../common/utils/money.js';

const CASH_TYPES = new Set(['CHECKING', 'DIGITAL', 'SAVINGS', 'WALLET', 'OTHER']);

export interface NetWorthParts {
  cash: Decimal;
  investments: Decimal;
  assets: Decimal;
  liabilities: Decimal;
  netWorth: Decimal;
}

/** Composição do patrimônio (contas ativas incluídas + investimentos + bens − dívidas). */
export function netWorthParts(input: {
  accounts: { type: string; currentBalance: Decimal | string }[];
  investmentsValue: Decimal | string;
  assetsValue: Decimal | string;
  liabilities: Decimal | string;
  /** Σ em aberto das faturas de cartão (parcelas futuras incluídas). */
  cardDebt?: Decimal | string;
}): NetWorthParts {
  let cash = new Decimal(0);
  let investmentAccounts = new Decimal(0);
  for (const account of input.accounts) {
    if (CASH_TYPES.has(account.type)) cash = cash.plus(account.currentBalance);
    else if (account.type === 'INVESTMENT')
      investmentAccounts = investmentAccounts.plus(account.currentBalance);
  }
  const investments = investmentAccounts.plus(input.investmentsValue);
  const assets = cash.plus(investments).plus(input.assetsValue);
  const liabilities = new Decimal(input.liabilities).plus(input.cardDebt ?? 0);
  return { cash, investments, assets, liabilities, netWorth: assets.minus(liabilities) };
}
