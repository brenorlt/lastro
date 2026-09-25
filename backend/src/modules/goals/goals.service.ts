import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  addMonthsYm,
  type DateOnly,
  fromDbDate,
  monthEnd,
  monthRange,
  monthStart,
  todayIn,
  toDbDate,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import {
  Decimal,
  decimalFrom,
  formatMoney,
  toDecimal,
  toMoneyString,
} from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Goal, GoalContribution, Prisma } from '../../generated/prisma/client.js';
import type { GoalStatus } from '../../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  ContributionDto,
  ContributionResultDto,
  CreateContributionDto,
  CreateGoalDto,
  GoalDetailDto,
  GoalDto,
  GoalsMetaDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './goal.dto.js';
import { cumulativeSeries, GOAL_DEFAULT_LOOK, goalMath } from './goal.calc.js';

type Tx = Prisma.TransactionClient;
type GoalWithCount = Goal & { _count: { contributions: number } };

/** ACTIVE ↔ COMPLETED conforme o saldo; PAUSED/ARCHIVED não mudam sozinhos. */
export function autoStatus(status: GoalStatus, current: Decimal, target: Decimal): GoalStatus {
  if (status === 'ACTIVE' && current.greaterThanOrEqualTo(target)) return 'COMPLETED';
  if (status === 'COMPLETED' && current.lessThan(target)) return 'ACTIVE';
  return status;
}

function toContributionDto(c: GoalContribution): ContributionDto {
  return {
    id: c.id,
    amount: toMoneyString(c.amount),
    date: fromDbDate(c.date),
    note: c.note,
    createdAt: c.createdAt.toISOString(),
  };
}

const futureDateError = () =>
  new AppException(ErrorCode.VALIDATION_ERROR, {
    details: [{ field: 'targetDate', message: 'A data da meta deve ser futura' }],
  });

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    userId: string,
    query: ListGoalsQueryDto,
  ): Promise<{ data: GoalDto[]; meta: GoalsMetaDto }> {
    const today = await this.today(userId);
    const status = query.status;
    const goals = await this.prisma.goal.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(status === 'ALL' ? {} : status ? { status } : { status: { not: 'ARCHIVED' } }),
      },
      include: { _count: { select: { contributions: true } } },
      orderBy: [
        { priority: 'desc' },
        { targetDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    const averages = await this.recentAverages(
      userId,
      goals.map((g) => g.id),
      today,
    );
    return {
      data: goals.map((g) => this.toDto(g, today, averages.get(g.id) ?? null)),
      meta: {
        totalTarget: toMoneyString(goals.reduce((a, g) => a.plus(g.targetAmount), new Decimal(0))),
        totalSaved: toMoneyString(goals.reduce((a, g) => a.plus(g.currentAmount), new Decimal(0))),
        count: goals.length,
      },
    };
  }

  async get(userId: string, id: string): Promise<GoalDetailDto> {
    const today = await this.today(userId);
    const goal = await this.findOwned(userId, id);
    const [contributions, all, averages] = await Promise.all([
      this.prisma.goalContribution.findMany({
        where: { goalId: id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      this.prisma.goalContribution.findMany({
        where: { goalId: id },
        select: { amount: true, date: true },
      }),
      this.recentAverages(userId, [id], today),
    ]);
    return {
      ...this.toDto(goal, today, averages.get(id) ?? null),
      contributions: contributions.map(toContributionDto),
      series: cumulativeSeries(
        monthRange(yearMonthOf(today), 12),
        all.map((c) => ({ amount: new Decimal(c.amount), date: fromDbDate(c.date) })),
      ),
    };
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const today = await this.today(userId);
    if (dto.targetDate && dto.targetDate <= today) throw futureDateError();
    const target = toDecimal(dto.targetAmount);
    const initial = dto.currentAmount ? toDecimal(dto.currentAmount) : new Decimal(0);
    const look = GOAL_DEFAULT_LOOK[dto.category];

    const goal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.goal.create({
        data: {
          userId,
          name: dto.name,
          category: dto.category,
          targetAmount: target,
          currentAmount: initial,
          targetDate: dto.targetDate ? toDbDate(dto.targetDate) : null,
          priority: dto.priority ?? 'MEDIUM',
          monthlyContribution: dto.monthlyContribution ? toDecimal(dto.monthlyContribution) : null,
          color: dto.color ?? look.color,
          icon: dto.icon ?? look.icon,
          status: autoStatus('ACTIVE', initial, target),
          completedAt: initial.greaterThanOrEqualTo(target) ? new Date() : null,
        },
      });
      if (initial.greaterThan(0)) {
        await tx.goalContribution.create({
          data: {
            userId,
            goalId: created.id,
            amount: initial,
            date: toDbDate(today),
            note: 'Valor inicial',
          },
        });
      }
      return created;
    });
    return this.getDto(userId, goal.id, today);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalDto> {
    const today = await this.today(userId);
    const goal = await this.findOwned(userId, id);
    if (
      dto.targetDate &&
      dto.targetDate <= today &&
      dto.targetDate !== this.dateOf(goal.targetDate)
    ) {
      throw futureDateError();
    }
    if (dto.name === null || dto.targetAmount === null || dto.category === null) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ message: 'name, category e targetAmount não podem ser nulos' }],
      });
    }
    const target = dto.targetAmount ? toDecimal(dto.targetAmount) : new Decimal(goal.targetAmount);
    const requested = dto.status ?? (goal.status === 'COMPLETED' ? 'ACTIVE' : goal.status);
    const status = autoStatus(requested, new Decimal(goal.currentAmount), target);

    await this.prisma.goal.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        targetAmount: target,
        targetDate:
          dto.targetDate === undefined
            ? undefined
            : dto.targetDate
              ? toDbDate(dto.targetDate)
              : null,
        priority: dto.priority,
        monthlyContribution:
          dto.monthlyContribution === undefined
            ? undefined
            : dto.monthlyContribution
              ? toDecimal(dto.monthlyContribution)
              : null,
        color: dto.color,
        icon: dto.icon,
        status,
        completedAt: status === 'COMPLETED' ? (goal.completedAt ?? new Date()) : null,
      },
    });
    if (status === 'COMPLETED' && goal.status !== 'COMPLETED')
      await this.notifyCompleted(userId, goal.name, id);
    return this.getDto(userId, id, today);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Aporte (positivo) ou resgate (negativo); o saldo é mantido por incremento atômico. */
  async addContribution(
    userId: string,
    id: string,
    dto: CreateContributionDto,
  ): Promise<ContributionResultDto> {
    const today = await this.today(userId);
    await this.findOwned(userId, id);
    if (dto.date > today) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'date', message: 'A data do aporte não pode ser futura' }],
      });
    }
    const amount = toDecimal(dto.amount);
    const { contribution, completed } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.goalContribution.create({
        data: { userId, goalId: id, amount, date: toDbDate(dto.date), note: dto.note ?? null },
      });
      const completedNow = await this.applyDelta(tx, id, amount);
      return { contribution: created, completed: completedNow };
    });
    if (completed) await this.notifyCompleted(userId, completed, id);
    return {
      goal: await this.getDto(userId, id, today),
      contribution: toContributionDto(contribution),
    };
  }

  async removeContribution(userId: string, id: string, contributionId: string): Promise<GoalDto> {
    const today = await this.today(userId);
    await this.findOwned(userId, id);
    const contribution = await this.prisma.goalContribution.findFirst({
      where: { id: contributionId, goalId: id, userId },
    });
    if (!contribution) throw new AppException(ErrorCode.CONTRIBUTION_NOT_FOUND);
    const completed = await this.prisma.$transaction(async (tx) => {
      await tx.goalContribution.delete({ where: { id: contributionId } });
      return this.applyDelta(tx, id, new Decimal(contribution.amount).neg());
    });
    if (completed) await this.notifyCompleted(userId, completed, id);
    return this.getDto(userId, id, today);
  }

  /** Aplica delta no saldo; saldo negativo desfaz a transação. Retorna o nome se concluiu agora. */
  private async applyDelta(tx: Tx, id: string, delta: Decimal): Promise<string | null> {
    const updated = await tx.goal.update({
      where: { id },
      data: { currentAmount: { increment: delta } },
    });
    const current = new Decimal(updated.currentAmount);
    if (current.lessThan(0)) throw new AppException(ErrorCode.GOAL_INSUFFICIENT_BALANCE);
    const status = autoStatus(updated.status, current, new Decimal(updated.targetAmount));
    if (status !== updated.status) {
      await tx.goal.update({
        where: { id },
        data: { status, completedAt: status === 'COMPLETED' ? new Date() : null },
      });
    }
    return status === 'COMPLETED' && updated.status !== 'COMPLETED' ? updated.name : null;
  }

  private async notifyCompleted(userId: string, name: string, goalId: string): Promise<void> {
    if (!(await this.notifications.isEnabled(userId, 'goalReminders'))) return;
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { targetAmount: true },
    });
    await this.notifications.create(userId, {
      type: 'GOAL_COMPLETED',
      title: `Meta "${name}" concluída!`,
      body: `Parabéns! Você alcançou ${formatMoney(goal?.targetAmount ?? 0)} na meta ${name}.`,
      data: { goalId, href: '/metas' },
    });
  }

  toDto(goal: GoalWithCount, today: DateOnly, recentAverage: Decimal | null): GoalDto {
    const target = new Decimal(goal.targetAmount);
    const current = new Decimal(goal.currentAmount);
    const targetDate = this.dateOf(goal.targetDate);
    const math = goalMath({
      today,
      targetAmount: target,
      currentAmount: current,
      targetDate,
      monthlyContribution: goal.monthlyContribution ? new Decimal(goal.monthlyContribution) : null,
      recentMonthlyAverage: recentAverage,
    });
    return {
      id: goal.id,
      name: goal.name,
      category: goal.category,
      color: goal.color,
      icon: goal.icon,
      priority: goal.priority,
      status: goal.status,
      targetAmount: toMoneyString(target),
      currentAmount: toMoneyString(current),
      ...math,
      targetDate,
      monthlyContribution: goal.monthlyContribution
        ? toMoneyString(goal.monthlyContribution)
        : null,
      contributionsCount: goal._count.contributions,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  /** Média mensal de aportes líquidos nos 3 meses completos anteriores (um groupBy). */
  async recentAverages(
    userId: string,
    goalIds: string[],
    today: DateOnly,
  ): Promise<Map<string, Decimal>> {
    if (!goalIds.length) return new Map();
    const lastComplete = addMonthsYm(yearMonthOf(today), -1);
    const window = monthRange(lastComplete, 3);
    const rows = await this.prisma.goalContribution.groupBy({
      by: ['goalId'],
      where: {
        userId,
        goalId: { in: goalIds },
        date: { gte: toDbDate(monthStart(window[0])), lte: toDbDate(monthEnd(window[2])) },
      },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.goalId, decimalFrom(r._sum.amount).div(3)]));
  }

  private async getDto(userId: string, id: string, today: DateOnly): Promise<GoalDto> {
    const goal = await this.findOwned(userId, id);
    const averages = await this.recentAverages(userId, [id], today);
    return this.toDto(goal, today, averages.get(id) ?? null);
  }

  private dateOf(value: Date | null): DateOnly | null {
    return value ? fromDbDate(value) : null;
  }

  private async today(userId: string): Promise<DateOnly> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayIn(user?.timezone ?? 'America/Sao_Paulo');
  }

  private async findOwned(userId: string, id: string): Promise<GoalWithCount> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
      include: { _count: { select: { contributions: true } } },
    });
    if (!goal) throw new AppException(ErrorCode.GOAL_NOT_FOUND);
    return goal;
  }
}
