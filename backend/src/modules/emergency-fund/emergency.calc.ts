import { addMonthsClamped, type DateOnly } from '../../common/utils/date-only.js';
import { Decimal, toMoneyString } from '../../common/utils/money.js';

export interface EmergencyMath {
  remaining: string;
  progress: number | null;
  coverageMonths: number | null;
  monthsToTarget: number | null;
  projectedDate: DateOnly | null;
}

const one = (v: Decimal) => Number(v.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));

export function emergencyMath(input: {
  today: DateOnly;
  current: Decimal;
  target: Decimal;
  monthlyCost: Decimal;
  monthlyContribution: Decimal | null;
}): EmergencyMath {
  const current = Decimal.max(input.current, 0);
  const remaining = Decimal.max(input.target.minus(current), 0);
  const contribution = input.monthlyContribution?.greaterThan(0) ? input.monthlyContribution : null;
  const monthsToTarget = remaining.isZero()
    ? 0
    : contribution
      ? remaining.div(contribution).ceil().toNumber()
      : null;
  return {
    remaining: toMoneyString(remaining),
    progress: input.target.greaterThan(0)
      ? Math.min(100, one(current.div(input.target).times(100)))
      : null,
    coverageMonths: input.monthlyCost.greaterThan(0) ? one(current.div(input.monthlyCost)) : null,
    monthsToTarget,
    projectedDate: monthsToTarget === null ? null : addMonthsClamped(input.today, monthsToTarget),
  };
}

/** Médias dos últimos 3 meses completos com movimento (despesa média e sobra média). */
export function emergencySuggestions(months: { income: Decimal; expense: Decimal }[]): {
  averageMonthlyExpense: string | null;
  averageMonthlySurplus: string | null;
} {
  const withData = months.filter((m) => m.income.greaterThan(0) || m.expense.greaterThan(0));
  if (!withData.length) return { averageMonthlyExpense: null, averageMonthlySurplus: null };
  const expense = withData.reduce((a, m) => a.plus(m.expense), new Decimal(0)).div(withData.length);
  const surplus = withData
    .reduce((a, m) => a.plus(m.income.minus(m.expense)), new Decimal(0))
    .div(withData.length);
  return {
    averageMonthlyExpense: expense.greaterThan(0) ? toMoneyString(expense) : null,
    averageMonthlySurplus: toMoneyString(surplus),
  };
}
