import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { groupNetWorth } from './net-worth.calc.js';

const d = (v: string) => new Decimal(v);

describe('groupNetWorth', () => {
  const result = groupNetWorth({
    accounts: [
      { id: 'a1', name: 'Corrente', type: 'CHECKING', currentBalance: d('5000') },
      { id: 'a2', name: 'Carteira', type: 'WALLET', currentBalance: d('-100') },
      { id: 'a3', name: 'XP', type: 'INVESTMENT', currentBalance: d('300') },
    ],
    investments: [{ id: 'i1', name: 'Tesouro', currentValue: d('10000') }],
    assets: [
      { id: 's1', name: 'Apartamento', type: 'REAL_ESTATE', value: d('400000') },
      { id: 's2', name: 'Dólares', type: 'CASH', value: d('1000') },
      { id: 's3', name: 'Carro', type: 'VEHICLE', value: d('60000') },
    ],
    liabilities: [
      { id: 'l1', name: 'Financiamento', type: 'FINANCING', outstandingBalance: d('250000') },
      { id: 'l2', name: 'Quitada', type: 'LOAN', outstandingBalance: d('0') },
    ],
    cards: [
      { id: 'c1', name: 'Nubank', debt: d('1500') },
      { id: 'c2', name: 'Sem uso', debt: d('0') },
    ],
  });

  it('soma dos grupos é igual aos totais de netWorthParts', () => {
    const assetSum = result.assets.groups.reduce((a, g) => a.plus(g.total), new Decimal(0));
    const liabilitySum = result.liabilities.groups.reduce(
      (a, g) => a.plus(g.total),
      new Decimal(0),
    );
    expect(assetSum.toFixed(2)).toBe(result.assets.total);
    expect(liabilitySum.toFixed(2)).toBe(result.liabilities.total);
    expect(result).toMatchObject({ netWorth: '224700.00', debtRatio: 52.8 }); // 476200 − 251500
    expect(result.parts.netWorth.toFixed(2)).toBe(result.netWorth);
  });

  it('agrupa com rótulos, fontes e links', () => {
    const groups = Object.fromEntries(result.assets.groups.map((g) => [g.key, g]));
    expect(groups.CASH).toMatchObject({ label: 'Dinheiro e contas', total: '5900.00' });
    expect(groups.INVESTMENTS.items.map((i) => [i.name, i.source])).toEqual([
      ['Tesouro', 'INVESTMENT'],
      ['XP (saldo em corretora)', 'ACCOUNT'],
    ]);
    expect(groups.REAL_ESTATE.items[0].href).toBe('/patrimonio/bens/s1');
    const debts = Object.fromEntries(result.liabilities.groups.map((g) => [g.key, g]));
    expect(debts.CREDIT_CARD.items).toEqual([
      { id: 'c1', name: 'Nubank', value: '1500.00', source: 'CARD', href: '/cartoes/c1' },
    ]);
    expect(debts.LOAN.items).toEqual([]);
    expect(result.assets.groups.map((g) => g.key)).toEqual([
      'CASH',
      'INVESTMENTS',
      'REAL_ESTATE',
      'VEHICLE',
      'OTHER',
    ]);
  });
});
