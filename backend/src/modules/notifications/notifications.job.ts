import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  addDays,
  type DateOnly,
  fromDbDate,
  todayIn,
  toDbDate,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom, formatMoney } from '../../common/utils/money.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { NotificationType } from '../../generated/prisma/enums.js';
import { monthLabel } from '../cards/invoice.calc.js';
import { emergencyCurrent } from '../emergency-fund/emergency-fund.service.js';
import { goalMath } from '../goals/goal.calc.js';
import { mergeNotificationPrefs, type NotificationPrefs } from '../users/notification-prefs.js';
import {
  billStage,
  cooledDown,
  invoiceStages,
  isFirstOfMonth,
  isMonday,
  previousWeek,
} from './notification-rules.js';
import {
  type NotificationInput,
  NotificationsService,
  type TopicKey,
} from './notifications.service.js';

const JOB_INTERVAL_MS = 60 * 60 * 1000;
const ddmm = (date: DateOnly) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

interface UserCtx {
  id: string;
  email: string;
  name: string;
  currency: string;
  prefs: NotificationPrefs;
  today: DateOnly;
}

/**
 * Avisos automáticos (a cada hora; cada aviso tem dedupeKey, então rodar várias vezes no
 * mesmo dia não duplica). Desligado em NODE_ENV=test; `run(now, userIds)` para testes.
 */
@Injectable()
export class NotificationsJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsJobService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;
    this.timer = setInterval(() => void this.run(), JOB_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 60_000).unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(
    now: Date = new Date(),
    userIds?: string[],
  ): Promise<Partial<Record<NotificationType, number>>> {
    const created: Partial<Record<NotificationType, number>> = {};
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(userIds ? { id: { in: userIds } } : {}) },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        timezone: true,
        notificationPrefs: true,
      },
    });
    for (const user of users) {
      const ctx: UserCtx = {
        ...user,
        prefs: mergeNotificationPrefs(user.notificationPrefs),
        today: todayIn(user.timezone, now),
      };
      const send = async (input: NotificationInput, topic: TopicKey, dedupeKey: string) => {
        const ok = await this.notifications.notify(ctx.id, input, {
          topic,
          dedupeKey,
          prefs: ctx.prefs,
          email: ctx.email,
          name: ctx.name,
        });
        if (ok) created[input.type] = (created[input.type] ?? 0) + 1;
      };
      try {
        if (ctx.prefs.billsDue) await this.bills(ctx, send);
        if (ctx.prefs.invoiceDue) await this.invoices(ctx, send);
        if (ctx.prefs.goalReminders) await this.goals(ctx, now, send);
        if (ctx.prefs.emergencyFund && isFirstOfMonth(ctx.today)) await this.emergency(ctx, send);
        if (ctx.prefs.weeklySummary && isMonday(ctx.today)) await this.weekly(ctx, send);
      } catch (error) {
        this.logger.error(
          { userId: user.id, err: error instanceof Error ? error.message : String(error) },
          'Falha ao gerar notificações',
        );
      }
    }
    return created;
  }

  private money(ctx: UserCtx, value: Decimal | string) {
    return formatMoney(value, ctx.currency);
  }

  private async bills(ctx: UserCtx, send: Sender) {
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId: ctx.id,
        deletedAt: null,
        status: 'PENDING',
        type: 'EXPENSE',
        creditCardId: null,
        date: { in: [addDays(ctx.today, 3), ctx.today, addDays(ctx.today, -1)].map(toDbDate) },
      },
    });
    for (const row of rows) {
      const stage = billStage(fromDbDate(row.date), ctx.today);
      if (!stage) continue;
      const prefix = {
        IN_3_DAYS: 'Vence em 3 dias',
        TODAY: 'Vence hoje',
        YESTERDAY: 'Venceu ontem',
      }[stage];
      await send(
        {
          type: 'BILL_DUE',
          title: `${prefix}: ${row.description}`,
          body: `${row.description} · ${this.money(ctx, row.amount)}`,
          data: { transactionId: row.id, stage, date: fromDbDate(row.date), href: '/lancamentos' },
        },
        'billsDue',
        `bill:${row.id}:${stage}`,
      );
    }
  }

  private async invoices(ctx: UserCtx, send: Sender) {
    const t = ctx.today;
    const invoices = await this.prisma.creditCardInvoice.findMany({
      where: {
        userId: ctx.id,
        card: { deletedAt: null },
        OR: [
          { closingDate: toDbDate(t) },
          { dueDate: { in: [addDays(t, 5), t, addDays(t, -1)].map(toDbDate) } },
        ],
      },
      include: { card: { select: { id: true, name: true } } },
    });
    for (const invoice of invoices) {
      const remaining = new Decimal(invoice.total).minus(invoice.paidAmount);
      const dueDate = fromDbDate(invoice.dueDate);
      const stages = invoiceStages(
        {
          closingDate: fromDbDate(invoice.closingDate),
          dueDate,
          hasRemaining: remaining.greaterThan(0),
          total: Number(invoice.total),
        },
        t,
      );
      const card = invoice.card.name;
      for (const stage of stages) {
        const title = {
          IN_5_DAYS: `Fatura do ${card} vence em 5 dias`,
          DUE_TODAY: `Fatura do ${card} vence hoje`,
          OVERDUE: `Fatura do ${card} está vencida`,
          CLOSED_TODAY: `Fatura do ${card} fechou: ${this.money(ctx, invoice.total)}, vence ${ddmm(dueDate)}`,
        }[stage];
        await send(
          {
            type: 'INVOICE_DUE',
            title,
            body: `${this.money(ctx, Decimal.max(remaining, 0))} em aberto · vencimento ${ddmm(dueDate)}`,
            data: {
              cardId: invoice.card.id,
              invoiceId: invoice.id,
              referenceMonth: yearMonthOf(fromDbDate(invoice.referenceMonth)),
              stage,
              href: `/cartoes/${invoice.card.id}`,
            },
          },
          'invoiceDue',
          `invoice:${invoice.id}:${stage}`,
        );
      }
    }
  }

  private async goals(ctx: UserCtx, now: Date, send: Sender) {
    const goals = await this.prisma.goal.findMany({
      where: { userId: ctx.id, deletedAt: null, status: 'ACTIVE', targetDate: { not: null } },
    });
    for (const goal of goals) {
      const targetDate = goal.targetDate ? fromDbDate(goal.targetDate) : null;
      const math = goalMath({
        today: ctx.today,
        targetAmount: new Decimal(goal.targetAmount),
        currentAmount: new Decimal(goal.currentAmount),
        targetDate,
        monthlyContribution: goal.monthlyContribution
          ? new Decimal(goal.monthlyContribution)
          : null,
        recentMonthlyAverage: null,
      });
      if (math.onTrack !== false || !targetDate || !math.requiredMonthly) continue;
      const last = await this.prisma.notification.findFirst({
        where: { userId: ctx.id, dedupeKey: { startsWith: `goal-behind:${goal.id}:` } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (!cooledDown(last?.createdAt ?? null, now, 30)) continue;
      await send(
        {
          type: 'GOAL_BEHIND',
          title: `${goal.name} está abaixo do ritmo`,
          body: `${goal.name} está abaixo do ritmo: guarde ${this.money(ctx, math.requiredMonthly)}/mês para chegar em ${monthLabel(yearMonthOf(targetDate))}.`,
          data: { goalId: goal.id, requiredMonthly: math.requiredMonthly, href: '/metas' },
        },
        'goalReminders',
        `goal-behind:${goal.id}:${ctx.today}`,
      );
    }
  }

  private async emergency(ctx: UserCtx, send: Sender) {
    const fund = await this.prisma.emergencyFund.findUnique({
      where: { userId: ctx.id },
      include: {
        linkedAccount: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            currentBalance: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!fund) return;
    const { current } = emergencyCurrent(fund);
    const target = new Decimal(fund.targetAmount);
    if (target.lessThanOrEqualTo(0) || current.greaterThanOrEqualTo(target)) return;
    const monthlyCost = new Decimal(fund.monthlyCost);
    const coverage = monthlyCost.greaterThan(0)
      ? Number(
          Decimal.max(current, 0)
            .div(monthlyCost)
            .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
            .toFixed(1),
        )
      : 0;
    const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
    await send(
      {
        type: 'EMERGENCY_BELOW_TARGET',
        title: 'Sua reserva ainda não chegou à meta',
        body: `Sua reserva cobre ${fmt.format(coverage)} ${coverage === 1 ? 'mês' : 'meses'} de ${fund.targetMonths} desejados.`,
        data: { coverageMonths: coverage, targetMonths: fund.targetMonths, href: '/reserva' },
      },
      'emergencyFund',
      `emergency:${yearMonthOf(ctx.today)}`,
    );
  }

  private async weekly(ctx: UserCtx, send: Sender) {
    const week = previousWeek(ctx.today);
    const [totals, top] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          userId: ctx.id,
          deletedAt: null,
          type: { in: ['INCOME', 'EXPENSE'] },
          date: { gte: toDbDate(week.from), lte: toDbDate(week.to) },
        },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<{ name: string | null; amount: unknown }[]>`
        SELECT root.name AS name, SUM(t.amount) AS amount
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN categories root ON root.id = COALESCE(c.parent_id, c.id)
        WHERE t.user_id = ${ctx.id}::uuid AND t.deleted_at IS NULL AND t.type = 'EXPENSE'
          AND t.date >= ${week.from}::date AND t.date <= ${week.to}::date
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
    ]);
    const sum = (type: string) => decimalFrom(totals.find((t) => t.type === type)?._sum.amount);
    const topName = top[0] ? (top[0].name ?? 'Sem categoria') : null;
    await send(
      {
        type: 'WEEKLY_SUMMARY',
        title: 'Seu resumo da semana',
        body:
          `Semana de ${ddmm(week.from)} a ${ddmm(week.to)}: receitas ${this.money(ctx, sum('INCOME'))}, ` +
          `despesas ${this.money(ctx, sum('EXPENSE'))}` +
          (topName ? `. Maior categoria: ${topName}.` : '.'),
        data: {
          week: week.week,
          income: sum('INCOME').toFixed(2),
          expense: sum('EXPENSE').toFixed(2),
          topCategory: topName,
          href: '/relatorios',
        },
      },
      'weeklySummary',
      `weekly:${week.week}`,
    );
  }
}

type Sender = (input: NotificationInput, topic: TopicKey, dedupeKey: string) => Promise<void>;
