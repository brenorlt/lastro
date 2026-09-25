import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import {
  budgetLevel,
  budgetPercent,
  overlaps,
  rootOf,
  spentByCategory,
  thresholdsToFire,
  unbudgetedSpent,
} from './budget.calc.js';

const d = (v: string) => new Decimal(v);
const parents = new Map<string, string | null>([
  ['food', null],
  ['market', 'food'],
  ['rest', 'food'],
  ['home', null],
  ['fun', null],
  ['cinema', 'fun'],
]);
const spend = new Map<string | null, Decimal>([
  ['food', d('100')],
  ['market', d('250.50')],
  ['rest', d('49.50')],
  ['home', d('1200')],
  ['cinema', d('60')],
  [null, d('30')],
]);

describe('budget calc', () => {
  it('níveis por percentual', () => {
    expect([0, 49.9, 50, 79.9, 80, 99.9, 100, 150].map(budgetLevel)).toEqual([
      'OK',
      'OK',
      'ATTENTION',
      'ATTENTION',
      'WARNING',
      'WARNING',
      'EXCEEDED',
      'EXCEEDED',
    ]);
    expect(budgetPercent(d('333.33'), d('1000'))).toBe(33.3);
    expect(budgetPercent(d('10'), d('0'))).toBe(0);
  });

  it('gasto da raiz inclui subcategorias; sub orçada conta só ela', () => {
    const spent = spentByCategory(['food', 'cinema'], spend, parents);
    expect(spent.get('food')?.toFixed(2)).toBe('400.00');
    expect(spent.get('cinema')?.toFixed(2)).toBe('60.00');
    expect(rootOf('market', parents)).toBe('food');
    expect(rootOf('home', parents)).toBe('home');
  });

  it('gasto fora de orçamento e sem categoria', () => {
    const { unbudgeted, uncategorized } = unbudgetedSpent(['food', 'cinema'], spend, parents);
    expect(unbudgeted.toFixed(2)).toBe('1200.00');
    expect(uncategorized.toFixed(2)).toBe('30.00');
  });

  it('sobreposição raiz ↔ subcategoria', () => {
    expect(overlaps({ id: 'market', parentId: 'food' }, [{ id: 'food', parentId: null }])).toBe(
      true,
    );
    expect(overlaps({ id: 'food', parentId: null }, [{ id: 'rest', parentId: 'food' }])).toBe(true);
    expect(overlaps({ id: 'market', parentId: 'food' }, [{ id: 'rest', parentId: 'food' }])).toBe(
      false,
    );
    expect(overlaps({ id: 'home', parentId: null }, [{ id: 'cinema', parentId: 'fun' }])).toBe(
      false,
    );
  });

  it('limiares: só para cima, uma vez; salto múltiplo notifica só o maior', () => {
    expect(thresholdsToFire([50, 80, 100], [], 40)).toEqual({ newlyFired: [], notify: null });
    expect(thresholdsToFire([50, 80, 100], [], 55)).toEqual({ newlyFired: [50], notify: 50 });
    expect(thresholdsToFire([50, 80, 100], [50], 85)).toEqual({ newlyFired: [80], notify: 80 });
    expect(thresholdsToFire([50, 80, 100], [50, 80], 60)).toEqual({ newlyFired: [], notify: null });
    expect(thresholdsToFire([50, 80, 100], [50, 80, 100], 150)).toEqual({
      newlyFired: [],
      notify: null,
    });
    expect(thresholdsToFire([100, 50, 80], [], 120)).toEqual({
      newlyFired: [50, 80, 100],
      notify: 100,
    });
  });
});
