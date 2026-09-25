import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Decimal } from '../../common/utils/money.js';
import { DEFAULT_ASSUMPTIONS, PlanningAssumptionsDto } from './planning.dto.js';
import { planningAverages } from './planning.service.js';

const errors = (patch: Record<string, unknown>) =>
  validateSync(plainToInstance(PlanningAssumptionsDto, { ...DEFAULT_ASSUMPTIONS, ...patch })).map(
    (e) => e.property,
  );

describe('planejamento', () => {
  it('valida faixas das premissas', () => {
    expect(errors({})).toEqual([]);
    expect(errors({ monthlyContribution: '1500.00', annualReturn: -10, inflation: 20 })).toEqual(
      [],
    );
    expect(errors({ horizonYears: 41 })).toEqual(['horizonYears']);
    expect(errors({ horizonYears: 0 })).toEqual(['horizonYears']);
    expect(errors({ annualReturn: 30.5 })).toEqual(['annualReturn']);
    expect(errors({ incomeGrowth: -11 })).toEqual(['incomeGrowth']);
    expect(errors({ expenseGrowth: 21 })).toEqual(['expenseGrowth']);
    expect(errors({ monthlyContribution: 1500 })).toEqual(['monthlyContribution']);
    expect(errors({ annualReturn: '8' })).toEqual(['annualReturn']);
  });

  it('médias: dados reais → onboarding → nada', () => {
    const d = (v: string) => new Decimal(v);
    expect(
      planningAverages(
        [
          { income: d('0'), expense: d('0') },
          { income: d('10000'), expense: d('6000') },
          { income: d('8000'), expense: d('5000') },
        ],
        { monthlyIncome: '1', monthlyExpenses: '1' },
      ),
    ).toEqual({ income: d('9000'), expense: d('5500'), quality: 'ACTUAL' });
    expect(
      planningAverages([{ income: d('0'), expense: d('0') }], {
        monthlyIncome: '7000.00',
        monthlyExpenses: '4000.00',
      }),
    ).toEqual({
      income: d('7000'),
      expense: d('4000'),
      quality: 'ONBOARDING',
    });
    expect(planningAverages([], null)).toEqual({ income: null, expense: null, quality: 'NONE' });
  });
});
