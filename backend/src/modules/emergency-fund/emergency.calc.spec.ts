import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { emergencyMath, emergencySuggestions } from './emergency.calc.js';

const d = (v: string) => new Decimal(v);

describe('emergency calc', () => {
  it('cobertura, progresso e projeção', () => {
    expect(
      emergencyMath({
        today: '2026-09-24',
        current: d('9000'),
        target: d('36000'),
        monthlyCost: d('6000'),
        monthlyContribution: d('1000'),
      }),
    ).toEqual({
      remaining: '27000.00',
      progress: 25,
      coverageMonths: 1.5,
      monthsToTarget: 27,
      projectedDate: '2028-12-24',
    });
    expect(
      emergencyMath({
        today: '2026-09-24',
        current: d('40000'),
        target: d('36000'),
        monthlyCost: d('6000'),
        monthlyContribution: null,
      }),
    ).toMatchObject({
      remaining: '0.00',
      progress: 100,
      monthsToTarget: 0,
      projectedDate: '2026-09-24',
    });
    expect(
      emergencyMath({
        today: '2026-09-24',
        current: d('-50'),
        target: d('0'),
        monthlyCost: d('0'),
        monthlyContribution: null,
      }),
    ).toEqual({
      remaining: '0.00',
      progress: null,
      coverageMonths: null,
      monthsToTarget: 0,
      projectedDate: '2026-09-24',
    });
    expect(
      emergencyMath({
        today: '2026-09-24',
        current: d('0'),
        target: d('100'),
        monthlyCost: d('10'),
        monthlyContribution: null,
      }).monthsToTarget,
    ).toBeNull();
  });

  it('sugestões consideram só meses com movimento', () => {
    expect(
      emergencySuggestions([
        { income: d('0'), expense: d('0') },
        { income: d('10000'), expense: d('6000') },
        { income: d('10000'), expense: d('7000') },
      ]),
    ).toEqual({ averageMonthlyExpense: '6500.00', averageMonthlySurplus: '3500.00' });
    expect(emergencySuggestions([{ income: d('0'), expense: d('0') }])).toEqual({
      averageMonthlyExpense: null,
      averageMonthlySurplus: null,
    });
  });
});
