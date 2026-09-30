import { describe, expect, it } from '@jest/globals';
import { type BalanceRelevant, balanceDelta, balanceEffects, expectedBalance } from './balance.js';
import { Prisma } from '../../generated/prisma/client.js';
import { computeTotals, type TotalsRow } from './totals.js';
import { resolveStatus } from './transactions.service.js';

const A = 'acc-a';
const B = 'acc-b';
const tx = (patch: Partial<BalanceRelevant>): BalanceRelevant => ({
  type: 'EXPENSE',
  status: 'CLEARED',
  amount: '10.00',
  accountId: A,
  transferAccountId: null,
  ...patch,
});
const str = (m: Map<string, { toFixed: (n: number) => string }>) =>
  Object.fromEntries([...m].map(([k, v]) => [k, v.toFixed(2)]));

describe('efeitos no saldo', () => {
  it('só CLEARED conta; transferência sai da origem e entra no destino', () => {
    expect(str(balanceEffects(tx({ type: 'INCOME', amount: '5.50' })))).toEqual({ [A]: '5.50' });
    expect(str(balanceEffects(tx({})))).toEqual({ [A]: '-10.00' });
    expect(balanceEffects(tx({ status: 'PENDING' })).size).toBe(0);
    expect(str(balanceEffects(tx({ type: 'TRANSFER', transferAccountId: B })))).toEqual({
      [A]: '-10.00',
      [B]: '10.00',
    });
  });

  it('delta de edição troca conta, valor e status', () => {
    const before = tx({ amount: '10.00' });
    expect(str(balanceDelta(before, { ...before, amount: '15.00' }))).toEqual({ [A]: '-5.00' });
    expect(str(balanceDelta(before, { ...before, accountId: B }))).toEqual({
      [A]: '10.00',
      [B]: '-10.00',
    });
    expect(str(balanceDelta(before, { ...before, status: 'PENDING' }))).toEqual({ [A]: '10.00' });
    expect(str(balanceDelta(null, before))).toEqual({ [A]: '-10.00' });
    expect(balanceDelta(before, before).size).toBe(0);
  });

  it('invariante: inicial + receitas − despesas − enviadas + recebidas (CLEARED)', () => {
    const list = [
      tx({ type: 'INCOME', amount: '1000.00' }),
      tx({ amount: '0.10' }),
      tx({ amount: '0.20' }),
      tx({ amount: '999.00', status: 'PENDING' }),
      tx({ type: 'TRANSFER', amount: '100.00', transferAccountId: B }),
      tx({ type: 'TRANSFER', amount: '30.00', accountId: B, transferAccountId: A }),
    ];
    expect(expectedBalance(A, '50.00', list).toFixed(2)).toBe('979.70');
    expect(expectedBalance(B, '0', list).toFixed(2)).toBe('70.00');
  });
});

describe('totais', () => {
  it('ignora transferências e separa pendentes', () => {
    const row = (
      type: TotalsRow['type'],
      status: TotalsRow['status'],
      count: number,
      sum: string,
    ) => ({
      type,
      status,
      count,
      sum: new Prisma.Decimal(sum),
    });
    const { total, totals } = computeTotals([
      row('INCOME', 'CLEARED', 2, '100.10'),
      row('INCOME', 'PENDING', 1, '50.00'),
      row('EXPENSE', 'CLEARED', 3, '0.30'),
      row('TRANSFER', 'CLEARED', 4, '999.00'),
    ]);
    expect(total).toBe(10);
    expect(totals).toEqual({
      income: '150.10',
      expense: '0.30',
      net: '149.80',
      pendingIncome: '50.00',
      pendingExpense: '0.00',
    });
  });
});

describe('regra de status', () => {
  it('padrão pela data; status explícito vale mesmo no futuro', () => {
    expect(resolveStatus(undefined, '2026-01-01', '2026-01-01')).toBe('CLEARED');
    expect(resolveStatus(undefined, '2026-01-02', '2026-01-01')).toBe('PENDING');
    expect(resolveStatus('PENDING', '2025-01-01', '2026-01-01')).toBe('PENDING');
    expect(resolveStatus('CLEARED', '2026-01-02', '2026-01-01')).toBe('CLEARED');
  });
});
