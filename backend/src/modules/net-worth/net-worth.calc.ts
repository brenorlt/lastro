import { Decimal, toMoneyString } from '../../common/utils/money.js';
import { netWorthParts } from '../dashboard/net-worth-parts.js';

export interface NetWorthInput {
  accounts: { id: string; name: string; type: string; currentBalance: Decimal }[];
  investments: { id: string; name: string; currentValue: Decimal }[];
  assets: { id: string; name: string; type: string; value: Decimal }[];
  liabilities: { id: string; name: string; type: string; outstandingBalance: Decimal }[];
  cards: { id: string; name: string; debt: Decimal }[];
}

type Item = { id: string; name: string; value: string; source: string; href: string };
type Group = { key: string; label: string; total: string; items: Item[] };

const ASSET_GROUPS = [
  ['CASH', 'Dinheiro e contas'],
  ['INVESTMENTS', 'Investimentos'],
  ['REAL_ESTATE', 'Imóveis'],
  ['VEHICLE', 'Veículos'],
  ['OTHER', 'Outros bens'],
] as const;

const LIABILITY_GROUPS = [
  ['CREDIT_CARD', 'Cartões de crédito'],
  ['LOAN', 'Empréstimos'],
  ['FINANCING', 'Financiamentos'],
  ['DEBT', 'Dívidas'],
  ['OTHER', 'Outras dívidas'],
] as const;

function build(
  defs: readonly (readonly [string, string])[],
  entries: { group: string; item: Item; value: Decimal }[],
): Group[] {
  return defs.map(([key, label]) => {
    const inGroup = entries
      .filter((e) => e.group === key)
      .sort((a, b) => b.value.comparedTo(a.value));
    return {
      key,
      label,
      total: toMoneyString(inGroup.reduce((acc, e) => acc.plus(e.value), new Decimal(0))),
      items: inGroup.map((e) => e.item),
    };
  });
}

/**
 * Patrimônio agrupado. Os totais vêm de `netWorthParts` (a mesma função do dashboard),
 * garantindo que a soma dos grupos seja idêntica ao netWorth exibido no painel.
 */
export function groupNetWorth(input: NetWorthInput) {
  const assetEntries: { group: string; item: Item; value: Decimal }[] = [];
  for (const a of input.accounts) {
    const broker = a.type === 'INVESTMENT';
    assetEntries.push({
      group: broker ? 'INVESTMENTS' : 'CASH',
      value: a.currentBalance,
      item: {
        id: a.id,
        name: broker ? `${a.name} (saldo em corretora)` : a.name,
        value: toMoneyString(a.currentBalance),
        source: 'ACCOUNT',
        href: `/contas/${a.id}`,
      },
    });
  }
  for (const i of input.investments) {
    assetEntries.push({
      group: 'INVESTMENTS',
      value: i.currentValue,
      item: {
        id: i.id,
        name: i.name,
        value: toMoneyString(i.currentValue),
        source: 'INVESTMENT',
        href: `/investimentos/${i.id}`,
      },
    });
  }
  for (const a of input.assets) {
    assetEntries.push({
      group: a.type === 'CASH' ? 'CASH' : a.type,
      value: a.value,
      item: {
        id: a.id,
        name: a.name,
        value: toMoneyString(a.value),
        source: 'ASSET',
        href: `/patrimonio/bens/${a.id}`,
      },
    });
  }

  const liabilityEntries: { group: string; item: Item; value: Decimal }[] = [];
  for (const c of input.cards) {
    if (c.debt.lessThanOrEqualTo(0)) continue;
    liabilityEntries.push({
      group: 'CREDIT_CARD',
      value: c.debt,
      item: {
        id: c.id,
        name: c.name,
        value: toMoneyString(c.debt),
        source: 'CARD',
        href: `/cartoes/${c.id}`,
      },
    });
  }
  for (const l of input.liabilities) {
    if (l.outstandingBalance.lessThanOrEqualTo(0)) continue;
    liabilityEntries.push({
      group: l.type,
      value: l.outstandingBalance,
      item: {
        id: l.id,
        name: l.name,
        value: toMoneyString(l.outstandingBalance),
        source: 'LIABILITY',
        href: `/patrimonio/dividas/${l.id}`,
      },
    });
  }

  const parts = netWorthParts({
    accounts: input.accounts,
    investmentsValue: input.investments.reduce((a, i) => a.plus(i.currentValue), new Decimal(0)),
    assetsValue: input.assets.reduce((a, i) => a.plus(i.value), new Decimal(0)),
    liabilities: input.liabilities.reduce((a, l) => a.plus(l.outstandingBalance), new Decimal(0)),
    cardDebt: input.cards.reduce((a, c) => a.plus(Decimal.max(c.debt, 0)), new Decimal(0)),
  });

  return {
    parts,
    netWorth: toMoneyString(parts.netWorth),
    assets: { total: toMoneyString(parts.assets), groups: build(ASSET_GROUPS, assetEntries) },
    liabilities: {
      total: toMoneyString(parts.liabilities),
      groups: build(LIABILITY_GROUPS, liabilityEntries),
    },
    debtRatio: parts.assets.greaterThan(0)
      ? Number(
          parts.liabilities
            .div(parts.assets)
            .times(100)
            .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
            .toFixed(1),
        )
      : null,
  };
}
