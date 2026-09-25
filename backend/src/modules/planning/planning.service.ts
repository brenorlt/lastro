import { Injectable } from '@nestjs/common';
import {
  addMonthsYm,
  fromDbDate,
  monthEnd,
  monthRange,
  monthStart,
  todayIn,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  emergencyCurrent,
  EmergencyFundService,
} from '../emergency-fund/emergency-fund.service.js';
import { groupNetWorth } from '../net-worth/net-worth.calc.js';
import { loadNetWorthInput } from '../net-worth/net-worth.loader.js';
import {
  DEFAULT_ASSUMPTIONS,
  type PlanningAssumptionsDto,
  type PlanningBaselineDto,
} from './planning.dto.js';

/** Médias mensais: meses completos com movimento → respostas do onboarding → nada. */
export function planningAverages(
  months: { income: Decimal; expense: Decimal }[],
  onboarding: { monthlyIncome?: string; monthlyExpenses?: string } | null,
) {
  const withData = months.filter((m) => m.income.greaterThan(0) || m.expense.greaterThan(0));
  if (withData.length) {
    const income = withData.reduce((a, m) => a.plus(m.income), new Decimal(0)).div(withData.length);
    const expense = withData
      .reduce((a, m) => a.plus(m.expense), new Decimal(0))
      .div(withData.length);
    return { income, expense, quality: 'ACTUAL' as const };
  }
  if (onboarding?.monthlyIncome || onboarding?.monthlyExpenses) {
    return {
      income: new Decimal(onboarding.monthlyIncome ?? 0),
      expense: new Decimal(onboarding.monthlyExpenses ?? 0),
      quality: 'ONBOARDING' as const,
    };
  }
  return { income: null, expense: null, quality: 'NONE' as const };
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emergencyFunds: EmergencyFundService,
  ) {}

  async baseline(userId: string): Promise<PlanningBaselineDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true, onboardingAnswers: true },
    });
    const window = monthRange(addMonthsYm(yearMonthOf(todayIn(user.timezone)), -1), 3);
    const [input, fund, debts, goals, rows] = await Promise.all([
      loadNetWorthInput(this.prisma, userId),
      this.emergencyFunds.findWithAccount(userId),
      this.prisma.liability.aggregate({
        where: { userId, deletedAt: null, outstandingBalance: { gt: 0 } },
        _sum: { monthlyPayment: true },
      }),
      this.prisma.goal.findMany({
        where: { userId, deletedAt: null, status: 'ACTIVE' },
        orderBy: [{ priority: 'desc' }, { targetDate: { sort: 'asc', nulls: 'last' } }],
      }),
      this.prisma.$queryRaw<{ month: string; type: string; amount: unknown }[]>`
        SELECT to_char(date, 'YYYY-MM') AS month, type::text AS type, SUM(amount) AS amount
        FROM transactions
        WHERE user_id = ${userId}::uuid AND deleted_at IS NULL AND type IN ('INCOME', 'EXPENSE')
          AND date >= ${monthStart(window[0])}::date AND date <= ${monthEnd(window[2])}::date
        GROUP BY 1, 2`,
    ]);
    const { parts } = groupNetWorth(input);
    const sum = (m: string, type: string) =>
      rows
        .filter((r) => r.month === m && r.type === type)
        .reduce((a, r) => a.plus(decimalFrom(r.amount)), new Decimal(0));
    const averages = planningAverages(
      window.map((m) => ({ income: sum(m, 'INCOME'), expense: sum(m, 'EXPENSE') })),
      user.onboardingAnswers as { monthlyIncome?: string; monthlyExpenses?: string } | null,
    );
    return {
      netWorth: toMoneyString(parts.netWorth),
      investable: toMoneyString(parts.investments),
      cash: toMoneyString(parts.cash),
      emergencyFund: fund
        ? {
            current: toMoneyString(emergencyCurrent(fund).current),
            target: toMoneyString(fund.targetAmount),
          }
        : null,
      averageMonthlyIncome: averages.income ? toMoneyString(averages.income) : null,
      averageMonthlyExpense: averages.expense ? toMoneyString(averages.expense) : null,
      averageMonthlySurplus:
        averages.income && averages.expense
          ? toMoneyString(averages.income.minus(averages.expense))
          : null,
      monthlyDebtPayments: toMoneyString(debts._sum.monthlyPayment ?? 0),
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: toMoneyString(g.targetAmount),
        currentAmount: toMoneyString(g.currentAmount),
        targetDate: g.targetDate ? fromDbDate(g.targetDate) : null,
      })),
      dataQuality: averages.quality,
    };
  }

  async assumptions(userId: string): Promise<PlanningAssumptionsDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planningAssumptions: true },
    });
    const saved = (user.planningAssumptions ?? {}) as Partial<PlanningAssumptionsDto>;
    return { ...DEFAULT_ASSUMPTIONS, ...saved };
  }

  async saveAssumptions(
    userId: string,
    dto: PlanningAssumptionsDto,
  ): Promise<PlanningAssumptionsDto> {
    const value: Prisma.InputJsonObject = {
      horizonYears: dto.horizonYears,
      monthlyContribution:
        dto.monthlyContribution === null ? null : toMoneyString(dto.monthlyContribution),
      annualReturn: dto.annualReturn,
      incomeGrowth: dto.incomeGrowth,
      expenseGrowth: dto.expenseGrowth,
      inflation: dto.inflation,
    };
    await this.prisma.user.update({ where: { id: userId }, data: { planningAssumptions: value } });
    return this.assumptions(userId);
  }
}
