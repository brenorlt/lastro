import {
  addMonthsClamped,
  type DateOnly,
  type YearMonth,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, toMoneyString } from '../../common/utils/money.js';

/** Meses inteiros do mês atual ao mês da data-alvo: mín. 1 se futura, 0 se já passou. */
export function goalMonthsLeft(today: DateOnly, targetDate: DateOnly | null): number | null {
  if (!targetDate) return null;
  if (targetDate <= today) return 0;
  const [y1, m1] = yearMonthOf(today).split('-').map(Number);
  const [y2, m2] = yearMonthOf(targetDate).split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

/** Divide arredondando PARA CIMA em centavos (quem segue o plano chega no alvo). */
export function divideRoundingUp(value: Decimal, parts: number): Decimal {
  return value.div(parts).toDecimalPlaces(2, Decimal.ROUND_UP);
}

export interface GoalMathInput {
  today: DateOnly;
  targetAmount: Decimal;
  currentAmount: Decimal;
  targetDate: DateOnly | null;
  monthlyContribution: Decimal | null;
  /** Média mensal de aportes líquidos recentes (fallback da projeção). */
  recentMonthlyAverage: Decimal | null;
}

export interface GoalMath {
  remaining: string;
  progress: number;
  monthsLeft: number | null;
  requiredMonthly: string | null;
  projectedCompletionDate: DateOnly | null;
  onTrack: boolean | null;
}

export function goalMath(input: GoalMathInput): GoalMath {
  const remaining = Decimal.max(input.targetAmount.minus(input.currentAmount), 0);
  const progress = input.targetAmount.greaterThan(0)
    ? Math.min(
        100,
        Math.max(
          0,
          Number(
            input.currentAmount
              .div(input.targetAmount)
              .times(100)
              .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
              .toFixed(1),
          ),
        ),
      )
    : 0;
  const monthsLeft = goalMonthsLeft(input.today, input.targetDate);
  const required =
    monthsLeft === null
      ? null
      : monthsLeft === 0
        ? remaining
        : divideRoundingUp(remaining, monthsLeft);

  const plan = input.monthlyContribution?.greaterThan(0) ? input.monthlyContribution : null;
  const rate =
    plan ?? (input.recentMonthlyAverage?.greaterThan(0) ? input.recentMonthlyAverage : null);
  let projected: DateOnly | null = null;
  if (remaining.isZero()) projected = null;
  else if (rate) {
    const months = remaining.div(rate).ceil().toNumber();
    projected = addMonthsClamped(input.today, months);
  }

  let onTrack: boolean | null = null;
  if (input.targetDate) {
    if (remaining.isZero()) onTrack = true;
    else if (projected) onTrack = projected <= input.targetDate;
    else if (plan && required) onTrack = required.lessThanOrEqualTo(plan);
    else onTrack = false;
  }

  return {
    remaining: toMoneyString(remaining),
    progress,
    monthsLeft,
    requiredMonthly: required ? toMoneyString(required) : null,
    projectedCompletionDate: projected,
    onTrack,
  };
}

/** Saldo acumulado ao fim de cada mês a partir de aportes (valor, data). */
export function cumulativeSeries(
  months: YearMonth[],
  contributions: { amount: Decimal; date: DateOnly }[],
): { month: YearMonth; saved: string }[] {
  return months.map((month) => ({
    month,
    saved: toMoneyString(
      contributions
        .filter((c) => yearMonthOf(c.date) <= month)
        .reduce((acc, c) => acc.plus(c.amount), new Decimal(0)),
    ),
  }));
}

export const GOAL_DEFAULT_LOOK: Record<string, { color: string; icon: string }> = {
  VEHICLE: { color: '#3B82F6', icon: 'car' },
  REAL_ESTATE: { color: '#F97316', icon: 'house' },
  TRAVEL: { color: '#0EA5E9', icon: 'plane' },
  EMERGENCY: { color: '#EF4444', icon: 'shield' },
  RETIREMENT: { color: '#8B5CF6', icon: 'sunset' },
  FINANCIAL_INDEPENDENCE: { color: '#16A34A', icon: 'trending-up' },
  EQUIPMENT: { color: '#64748B', icon: 'laptop' },
  EDUCATION: { color: '#6366F1', icon: 'graduation-cap' },
  OTHER: { color: '#14B8A6', icon: 'target' },
};
