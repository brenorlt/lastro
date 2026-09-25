import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { cumulativeSeries, divideRoundingUp, goalMath, goalMonthsLeft } from './goal.calc.js';
import { autoStatus } from './goals.service.js';

const d = (v: string) => new Decimal(v);
const base = {
  today: '2026-09-24',
  targetAmount: d('10000'),
  currentAmount: d('1000'),
  targetDate: '2027-09-10' as string | null,
  monthlyContribution: null as Decimal | null,
  recentMonthlyAverage: null as Decimal | null,
};

describe('goal calc', () => {
  it('monthsLeft: meses de calendário, mín. 1 no futuro, 0 no passado', () => {
    expect(goalMonthsLeft('2026-09-24', '2027-09-10')).toBe(12);
    expect(goalMonthsLeft('2026-09-24', '2026-09-30')).toBe(1);
    expect(goalMonthsLeft('2026-09-24', '2026-09-24')).toBe(0);
    expect(goalMonthsLeft('2026-09-24', '2025-01-01')).toBe(0);
    expect(goalMonthsLeft('2026-09-24', null)).toBeNull();
  });

  it('requiredMonthly arredonda para cima em centavos', () => {
    expect(divideRoundingUp(d('100'), 3).toFixed(2)).toBe('33.34');
    expect(
      goalMath({ ...base, currentAmount: d('0'), targetAmount: d('1000') }).requiredMonthly,
    ).toBe('83.34');
    expect(goalMath({ ...base, targetDate: '2026-01-01' }).requiredMonthly).toBe('9000.00');
    expect(goalMath({ ...base, targetDate: null }).requiredMonthly).toBeNull();
  });

  it('projeção pelo plano, senão pela média recente; onTrack', () => {
    const byPlan = goalMath({ ...base, monthlyContribution: d('1000') });
    expect(byPlan).toMatchObject({
      remaining: '9000.00',
      progress: 10,
      projectedCompletionDate: '2027-06-24',
      onTrack: true,
    });
    const slow = goalMath({ ...base, monthlyContribution: d('500') });
    expect(slow).toMatchObject({ projectedCompletionDate: '2028-03-24', onTrack: false });
    const byHistory = goalMath({ ...base, recentMonthlyAverage: d('3000') });
    expect(byHistory.projectedCompletionDate).toBe('2026-12-24');
    const nothing = goalMath(base);
    expect(nothing).toMatchObject({ projectedCompletionDate: null, onTrack: false });
    expect(goalMath({ ...base, targetDate: null }).onTrack).toBeNull();
    const done = goalMath({ ...base, currentAmount: d('12000') });
    expect(done).toMatchObject({
      remaining: '0.00',
      progress: 100,
      onTrack: true,
      projectedCompletionDate: null,
    });
  });

  it('status automático', () => {
    expect(autoStatus('ACTIVE', d('100'), d('100'))).toBe('COMPLETED');
    expect(autoStatus('COMPLETED', d('99.99'), d('100'))).toBe('ACTIVE');
    expect(autoStatus('PAUSED', d('500'), d('100'))).toBe('PAUSED');
  });

  it('série cumulativa por fim de mês', () => {
    expect(
      cumulativeSeries(
        ['2026-07', '2026-08', '2026-09'],
        [
          { amount: d('100'), date: '2026-06-01' },
          { amount: d('50'), date: '2026-08-31' },
          { amount: d('-30'), date: '2026-09-02' },
        ],
      ),
    ).toEqual([
      { month: '2026-07', saved: '100.00' },
      { month: '2026-08', saved: '150.00' },
      { month: '2026-09', saved: '120.00' },
    ]);
  });
});
