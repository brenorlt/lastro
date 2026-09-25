import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { monthsUntil, todayIn, toDbDate } from '../../common/utils/date-only.js';
import { Decimal, roundMoney, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  OnboardingDto,
  OnboardingResultDto,
  OnboardingSummaryDto,
} from './dto/onboarding.dto.js';
import type { UserDto } from './dto/user.dto.js';
import { toUserDto } from './user.mapper.js';

type Tx = Prisma.TransactionClient;

export { monthsUntil };

const oneDecimal = (value: Decimal) =>
  Number(value.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));

/** Resumo exibido ao fim do onboarding (função pura, testável). */
export function onboardingSummary(input: {
  monthlyIncome: string;
  monthlyExpenses: string;
  cashBalance: string;
  investments: string;
  debts: string;
  emergencyMonths: number;
  goalMonthlyContribution: Decimal | null;
}): OnboardingSummaryDto {
  const income = toDecimal(input.monthlyIncome);
  const expenses = toDecimal(input.monthlyExpenses);
  const cash = toDecimal(input.cashBalance);
  const investments = toDecimal(input.investments);
  const debts = toDecimal(input.debts);
  const surplus = income.minus(expenses);
  return {
    netWorth: toMoneyString(cash.plus(investments).minus(debts)),
    cash: toMoneyString(cash),
    investments: toMoneyString(investments),
    debts: toMoneyString(debts),
    savingsRate: income.isZero() ? null : oneDecimal(surplus.div(income).times(100)),
    monthlySurplus: toMoneyString(surplus),
    emergencyTarget: toMoneyString(expenses.times(input.emergencyMonths)),
    emergencyCoverageMonths: expenses.isZero()
      ? null
      : oneDecimal(Decimal.max(cash, 0).div(expenses)),
    goalMonthlyContribution: input.goalMonthlyContribution
      ? toMoneyString(input.goalMonthlyContribution)
      : null,
  };
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async complete(userId: string, dto: OnboardingDto): Promise<OnboardingResultDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.onboardingCompletedAt) throw new AppException(ErrorCode.ONBOARDING_ALREADY_COMPLETED);
    const today = todayIn(user.timezone);

    await this.assertExpenseCategories(userId, dto.topExpenseCategoryIds);
    if (dto.goal?.targetDate && dto.goal.targetDate <= today) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'goal.targetDate', message: 'A data da meta deve ser futura' }],
      });
    }

    const expenses = toDecimal(dto.monthlyExpenses);
    const emergencyTarget = expenses.times(dto.emergencyMonths);

    // Meta: sem valor-alvo, EMERGENCY herda o alvo da reserva; as demais ficam com 0.
    const goalTarget = dto.goal
      ? dto.goal.targetAmount
        ? toDecimal(dto.goal.targetAmount)
        : dto.goal.category === 'EMERGENCY'
          ? emergencyTarget
          : new Decimal(0)
      : null;
    const goalMonthly =
      dto.goal?.targetDate && goalTarget && goalTarget.greaterThan(0)
        ? roundMoney(goalTarget.div(monthsUntil(today, dto.goal.targetDate)))
        : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Condicional: duas submissões simultâneas → só uma conclui.
      const { count } = await tx.user.updateMany({
        where: { id: userId, onboardingCompletedAt: null },
        data: {
          onboardingCompletedAt: new Date(),
          onboardingAnswers: {
            monthlyIncome: toMoneyString(dto.monthlyIncome),
            monthlyExpenses: toMoneyString(dto.monthlyExpenses),
            topExpenseCategoryIds: dto.topExpenseCategoryIds,
            answeredAt: new Date().toISOString(),
          },
        },
      });
      if (count !== 1) throw new AppException(ErrorCode.ONBOARDING_ALREADY_COMPLETED);

      const cash = toDecimal(dto.cashBalance);
      await tx.account.create({
        data: {
          userId,
          name: await this.availableName(tx, userId, dto.mainAccountName || 'Conta principal'),
          institution: dto.institution || null,
          type: 'CHECKING',
          initialBalance: cash,
          currentBalance: cash,
          color: '#3F51D8',
          icon: 'landmark',
        },
      });

      if (dto.investments) {
        const total = toDecimal(dto.investments.total);
        await tx.account.create({
          data: {
            userId,
            name: await this.availableName(tx, userId, 'Investimentos'),
            type: 'INVESTMENT',
            initialBalance: total,
            currentBalance: total,
            color: '#8B5CF6',
            icon: 'trending-up',
          },
        });
      }

      if (dto.debts) {
        const outstanding = toDecimal(dto.debts.outstanding);
        await tx.liability.create({
          data: {
            userId,
            name: 'Dívidas informadas no onboarding',
            type: 'DEBT',
            principal: outstanding,
            outstandingBalance: outstanding,
            monthlyPayment: dto.debts.monthlyPayment ? toDecimal(dto.debts.monthlyPayment) : null,
          },
        });
      }

      const fund = {
        monthlyCost: expenses,
        targetMonths: dto.emergencyMonths,
        targetAmount: emergencyTarget,
      };
      await tx.emergencyFund.upsert({
        where: { userId },
        create: { userId, ...fund, currentAmount: 0 },
        update: fund,
      });

      if (dto.goal && goalTarget) {
        await tx.goal.create({
          data: {
            userId,
            name: dto.goal.name,
            category: dto.goal.category,
            targetAmount: goalTarget,
            currentAmount: 0,
            targetDate: dto.goal.targetDate ? toDbDate(dto.goal.targetDate) : null,
            priority: 'HIGH',
            monthlyContribution: goalMonthly,
            status: 'ACTIVE',
          },
        });
      }

      return tx.user.findUniqueOrThrow({ where: { id: userId } });
    });

    return {
      user: toUserDto(updated),
      summary: onboardingSummary({
        monthlyIncome: dto.monthlyIncome,
        monthlyExpenses: dto.monthlyExpenses,
        cashBalance: dto.cashBalance,
        investments: dto.investments?.total ?? '0',
        debts: dto.debts?.outstanding ?? '0',
        emergencyMonths: dto.emergencyMonths,
        goalMonthlyContribution: goalMonthly,
      }),
    };
  }

  /** Pula o onboarding (marca como concluído para não redirecionar de novo). */
  async skip(userId: string): Promise<UserDto> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: new Date() },
    });
    if (count !== 1) throw new AppException(ErrorCode.ONBOARDING_ALREADY_COMPLETED);
    return toUserDto(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  private async assertExpenseCategories(userId: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const found = await this.prisma.category.count({
      where: { id: { in: ids }, userId, deletedAt: null, type: 'EXPENSE' },
    });
    if (found !== ids.length) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [
          {
            field: 'topExpenseCategoryIds',
            message: 'Escolha apenas categorias de despesa da sua conta',
          },
        ],
      });
    }
  }

  /** Nome livre entre contas ativas: "X", "X (2)", "X (3)"… (citext = case-insensitive). */
  private async availableName(tx: Tx, userId: string, base: string): Promise<string> {
    for (let n = 1; n < 100; n++) {
      const name = n === 1 ? base : `${base.slice(0, 55)} (${n})`;
      const clash = await tx.account.findFirst({
        where: { userId, name, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!clash) return name;
    }
    return `${base.slice(0, 50)} (${Date.now() % 10000})`;
  }
}
