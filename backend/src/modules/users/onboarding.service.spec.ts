import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { monthsUntil, onboardingSummary } from './onboarding.service.js';

describe('onboarding', () => {
  it('resumo com decimais exatos', () => {
    expect(
      onboardingSummary({
        monthlyIncome: '10000.00',
        monthlyExpenses: '6000.00',
        cashBalance: '18000.00',
        investments: '25000.50',
        debts: '8000.00',
        emergencyMonths: 6,
        goalMonthlyContribution: new Decimal('1250'),
      }),
    ).toEqual({
      netWorth: '35000.50',
      cash: '18000.00',
      investments: '25000.50',
      debts: '8000.00',
      savingsRate: 40,
      monthlySurplus: '4000.00',
      emergencyTarget: '36000.00',
      emergencyCoverageMonths: 3,
      goalMonthlyContribution: '1250.00',
    });
  });

  it('renda/gastos zero → null; caixa negativo não gera cobertura negativa', () => {
    const summary = onboardingSummary({
      monthlyIncome: '0',
      monthlyExpenses: '0',
      cashBalance: '-100.00',
      investments: '0',
      debts: '0',
      emergencyMonths: 3,
      goalMonthlyContribution: null,
    });
    expect(summary).toMatchObject({
      savingsRate: null,
      emergencyCoverageMonths: null,
      netWorth: '-100.00',
    });
    const low = onboardingSummary({
      monthlyIncome: '3000',
      monthlyExpenses: '3100',
      cashBalance: '-50',
      investments: '0',
      debts: '0',
      emergencyMonths: 1,
      goalMonthlyContribution: null,
    });
    expect(low).toMatchObject({
      savingsRate: -3.3,
      emergencyCoverageMonths: 0,
      monthlySurplus: '-100.00',
    });
  });

  it('meses até a meta arredondam para cima', () => {
    expect(monthsUntil('2026-09-24', '2027-09-24')).toBe(12);
    expect(monthsUntil('2026-09-24', '2027-09-25')).toBe(13);
    expect(monthsUntil('2026-09-24', '2026-09-30')).toBe(1);
  });
});
