import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { liabilityMath } from './liability.calc.js';

const d = (v: string) => new Decimal(v);

describe('liabilityMath', () => {
  it('% quitado e parcelas restantes arredondadas para cima', () => {
    expect(liabilityMath(d('20000'), d('15000'), d('850'))).toEqual({
      paidPercent: 25,
      remainingInstallments: 18,
    });
    expect(liabilityMath(d('20000'), d('15000'), null)).toEqual({
      paidPercent: 25,
      remainingInstallments: null,
    });
    expect(liabilityMath(d('1000'), d('0'), d('100'))).toEqual({
      paidPercent: 100,
      remainingInstallments: 0,
    });
    expect(liabilityMath(d('0'), d('0'), null)).toEqual({
      paidPercent: 0,
      remainingInstallments: 0,
    });
  });
});
