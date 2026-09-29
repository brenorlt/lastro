import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { paginate, toPrismaPagination } from '../../common/utils/pagination.js';
import { Decimal, toMoneyString } from '../../common/utils/money.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Payment, Subscription, User } from '../../generated/prisma/client.js';
import type {
  AdminOverviewDto,
  AdminPaymentDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUsersQueryDto,
} from './dto/admin.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGNUPS_WINDOW_DAYS = 30;
const RECENT_PAYMENTS_LIMIT = 10;
const DEFAULT_GRANT_DAYS = 30;

type PaymentWithUser = Payment & { user: Pick<User, 'name' | 'email'> };

function toPaymentDto(payment: PaymentWithUser): AdminPaymentDto {
  return {
    id: payment.id,
    userId: payment.userId,
    userName: payment.user.name,
    userEmail: payment.user.email,
    method: payment.method,
    status: payment.status,
    amount: toMoneyString(payment.amount),
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
  };
}

function toUserListItemDto(
  user: User & { subscription: Subscription | null },
): AdminUserListItemDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subscriptionStatus: user.subscription?.status ?? 'TRIALING',
    trialEndsAt: (user.subscription?.trialEndsAt ?? user.createdAt).toISOString(),
    currentPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  private get planPriceCents(): number {
    return this.config.get('BILLING_PLAN_PRICE_CENTS');
  }

  async overview(): Promise<AdminOverviewDto> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - SIGNUPS_WINDOW_DAYS * DAY_MS);

    const [totalUsers, statusCounts, pendingPayments, recentSignups, recentPaymentRows] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.payment.count({ where: { status: 'PENDING' } }),
        this.prisma.user.findMany({
          where: { createdAt: { gte: windowStart } },
          select: { createdAt: true },
        }),
        this.prisma.payment.findMany({
          take: RECENT_PAYMENTS_LIMIT,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, email: true } } },
        }),
      ]);

    const countFor = (status: string) =>
      statusCounts.find((s) => s.status === status)?._count._all ?? 0;
    const activeCount = countFor('ACTIVE');

    return {
      totalUsers,
      trialingCount: countFor('TRIALING'),
      activeCount,
      blockedCount: countFor('BLOCKED'),
      cancelledCount: countFor('CANCELLED'),
      mrrEstimate: toMoneyString(
        new Decimal(this.planPriceCents).times(activeCount).dividedBy(100),
      ),
      pendingPayments,
      signupsByDay: buildSignupsByDay(recentSignups, windowStart, now),
      recentPayments: recentPaymentRows.map(toPaymentDto),
    };
  }

  async listUsers(query: AdminUsersQueryDto) {
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { subscription: true },
        orderBy: { createdAt: 'desc' },
        ...toPrismaPagination(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(users.map(toUserListItemDto), total, query);
  }

  async getUser(id: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);

    return {
      ...toUserListItemDto(user),
      phone: user.phone,
      payments: user.payments.map((p) =>
        toPaymentDto({ ...p, user: { name: user.name, email: user.email } }),
      ),
    };
  }

  async grantAccess(id: string, days: number): Promise<void> {
    const subscription = await this.findSubscriptionOrThrow(id);
    const now = new Date();
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: extendPeriod(subscription.currentPeriodEnd, now, days),
      },
    });
  }

  async block(id: string): Promise<void> {
    const subscription = await this.findSubscriptionOrThrow(id);
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'BLOCKED' },
    });
  }

  async unblock(id: string): Promise<void> {
    const subscription = await this.findSubscriptionOrThrow(id);
    const now = new Date();
    const stillValid =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() > now.getTime();
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        ...(stillValid ? {} : { currentPeriodEnd: extendPeriod(null, now, DEFAULT_GRANT_DAYS) }),
      },
    });
  }

  private async findSubscriptionOrThrow(userId: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new AppException(ErrorCode.USER_NOT_FOUND);
    return subscription;
  }
}

function extendPeriod(current: Date | null, now: Date, days: number): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * DAY_MS);
}

function buildSignupsByDay(
  signups: { createdAt: Date }[],
  windowStart: Date,
  now: Date,
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { createdAt } of signups) {
    const key = createdAt.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const days: { date: string; count: number }[] = [];
  for (let t = startOfDay(windowStart); t <= startOfDay(now); t += DAY_MS) {
    const key = new Date(t).toISOString().slice(0, 10);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return days;
}

function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
