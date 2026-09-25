import { Injectable } from '@nestjs/common';
import {
  addDays,
  addMonthsYm,
  fromDbDate,
  monthEnd,
  monthRange,
  monthStart,
  todayIn,
  toDbDate,
  type YearMonth,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  emergencyCurrent,
  EmergencyFundService,
} from '../emergency-fund/emergency-fund.service.js';
import { goalMath } from '../goals/goal.calc.js';
import { InvestmentsService } from '../investments/investments.service.js';
import { groupNetWorth } from '../net-worth/net-worth.calc.js';
import type { NetWorthParts } from './net-worth-parts.js';
import { loadNetWorthInput } from '../net-worth/net-worth.loader.js';
import { TRANSACTION_INCLUDE, toTransactionDto } from '../transactions/transaction.mapper.js';
import {
  averageMonthlyExpense,
  buildInsights,
  type CategorySpend,
  flowOf,
  indexFlows,
  type MonthlyFlowRow,
  pct1,
  reconstructNetWorth,
  rollupSpending,
  UNCATEGORIZED,
} from './dashboard.calc.js';

const dec = decimalFrom;

export { netWorthParts, type NetWorthParts } from './net-worth-parts.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emergencyFunds: EmergencyFundService,
    private readonly investments: InvestmentsService,
  ) {}

  /** Partes do patrimônio atual (mesma fonte e função do /net-worth). */
  async currentParts(userId: string): Promise<NetWorthParts> {
    return groupNetWorth(await loadNetWorthInput(this.prisma, userId)).parts;
  }

  /**
   * Faturas dos cartões não excluídos: dívida (Σ em aberto), limite dos ativos e a
   * lista de faturas em aberto (para compromissos e próximo vencimento).
   */
  async cardsSummary(userId: string) {
    const cards = await this.prisma.creditCard.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        limit: true,
        status: true,
        invoices: {
          select: { referenceMonth: true, dueDate: true, total: true, paidAmount: true },
        },
      },
    });
    let debt = new Decimal(0);
    let totalLimit = new Decimal(0);
    const open: { cardId: string; referenceMonth: string; dueDate: string; remaining: Decimal }[] =
      [];
    for (const card of cards) {
      if (card.status === 'ACTIVE') totalLimit = totalLimit.plus(card.limit);
      for (const invoice of card.invoices) {
        const remaining = dec(invoice.total).minus(invoice.paidAmount);
        if (remaining.lessThanOrEqualTo(0)) continue;
        debt = debt.plus(remaining);
        open.push({
          cardId: card.id,
          referenceMonth: fromDbDate(invoice.referenceMonth).slice(0, 7),
          dueDate: fromDbDate(invoice.dueDate),
          remaining,
        });
      }
    }
    open.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { debt, totalLimit, open };
  }

  async get(userId: string, requestedMonth?: YearMonth) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true, currency: true, onboardingAnswers: true },
    });
    const today = todayIn(user.timezone);
    const currentMonth = yearMonthOf(today);
    const month = requestedMonth ?? currentMonth;
    const seriesMonths = monthRange(month, 12);
    const baseMonth = addMonthsYm(month, -12);
    const flowStart = [addMonthsYm(month, -11), addMonthsYm(currentMonth, -12)].sort()[0];

    const [
      parts,
      flowRows,
      commitmentRows,
      spendingRows,
      fund,
      monthlyPayments,
      snapshots,
      goals,
      upcoming,
      recent,
    ] = await Promise.all([
      this.currentParts(userId),
      this.prisma.$queryRaw<
        {
          month: string;
          type: 'INCOME' | 'EXPENSE';
          status: MonthlyFlowRow['status'];
          amount: unknown;
        }[]
      >`
          SELECT to_char(t.date, 'YYYY-MM') AS month, t.type::text AS type, t.status::text AS status,
                 SUM(t.amount) AS amount
          FROM transactions t
          WHERE t.user_id = ${userId}::uuid AND t.deleted_at IS NULL
            AND t.type IN ('INCOME', 'EXPENSE') AND t.date >= ${monthStart(flowStart)}::date
          GROUP BY 1, 2, 3`,
      this.prisma.$queryRaw<
        {
          next_amount: unknown;
          next_count: unknown;
          overdue_amount: unknown;
          overdue_count: unknown;
        }[]
      >`
          SELECT COALESCE(SUM(amount) FILTER (WHERE date >= ${today}::date AND date <= ${addDays(today, 30)}::date), 0) AS next_amount,
                 COUNT(*) FILTER (WHERE date >= ${today}::date AND date <= ${addDays(today, 30)}::date) AS next_count,
                 COALESCE(SUM(amount) FILTER (WHERE date < ${today}::date), 0) AS overdue_amount,
                 COUNT(*) FILTER (WHERE date < ${today}::date) AS overdue_count
          FROM transactions
          WHERE user_id = ${userId}::uuid AND deleted_at IS NULL AND status = 'PENDING' AND type = 'EXPENSE'
            AND credit_card_id IS NULL`,
      this.prisma.$queryRaw<{ root_id: string | null; amount: unknown }[]>`
          SELECT COALESCE(c.parent_id, c.id) AS root_id, SUM(t.amount) AS amount
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ${userId}::uuid AND t.deleted_at IS NULL AND t.type = 'EXPENSE'
            AND t.date >= ${monthStart(month)}::date AND t.date <= ${monthEnd(month)}::date
          GROUP BY 1`,
      this.emergencyFunds.findWithAccount(userId),
      this.prisma.liability.aggregate({
        where: { userId, deletedAt: null, outstandingBalance: { gt: 0 } },
        _sum: { monthlyPayment: true },
      }),
      this.prisma.financialSnapshot.findMany({
        where: {
          userId,
          date: {
            in: [baseMonth, ...seriesMonths]
              .filter((m) => m < currentMonth)
              .map((m) => toDbDate(monthEnd(m))),
          },
        },
        select: { date: true, netWorth: true },
      }),
      this.prisma.goal.findMany({
        where: { userId, deletedAt: null, status: 'ACTIVE' },
        orderBy: [
          { priority: 'desc' },
          { targetDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
        take: 4,
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          status: 'PENDING',
          creditCardId: null, // parcelas de cartão entram via fatura, não individualmente
          date: { gte: toDbDate(addDays(today, -30)), lte: toDbDate(addDays(today, 14)) },
        },
        include: TRANSACTION_INCLUDE,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        take: 6,
      }),
      this.prisma.transaction.findMany({
        where: { userId, deletedAt: null, date: { lte: toDbDate(today) } },
        include: TRANSACTION_INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
    ]);

    // ── Fluxos ──
    const flows = indexFlows(
      flowRows.map((r) => ({
        month: r.month,
        type: r.type,
        status: r.status,
        amount: dec(r.amount),
      })),
    );
    const flow = flowOf(flows, month);
    const previous = flowOf(flows, addMonthsYm(month, -1));

    // ── Patrimônio ──
    const snapshotByMonth = new Map(
      snapshots.map((s) => [yearMonthOf(fromDbDate(s.date)), dec(s.netWorth)]),
    );
    const series = reconstructNetWorth(
      parts.netWorth,
      [baseMonth, ...seriesMonths],
      flows,
      snapshotByMonth,
    );
    const [base, ...points] = series.points;
    const last = points[points.length - 1].value;
    const changeAmount = last.minus(base.value);

    // ── Reserva ──
    let emergencyFund = null;
    let emergencyForInsight: { coverageMonths: number | null; targetMonths: number } | null = null;
    if (fund) {
      const { mode, current } = emergencyCurrent(fund);
      const linked = mode === 'LINKED';
      const answers = user.onboardingAnswers as { monthlyExpenses?: string } | null;
      const avg = averageMonthlyExpense(currentMonth, flows, [
        fund.monthlyCost,
        answers?.monthlyExpenses,
      ]);
      const coverageMonths = avg ? pct1(Decimal.max(current, 0).div(avg)) : null;
      const target = dec(fund.targetAmount);
      emergencyFund = {
        current: toMoneyString(current),
        target: toMoneyString(target),
        targetMonths: fund.targetMonths,
        coverageMonths,
        progress: target.greaterThan(0)
          ? Math.min(100, Math.max(0, pct1(current.div(target).times(100))))
          : null,
      };
      const funded = Boolean(linked) || current.greaterThan(0);
      emergencyForInsight = {
        coverageMonths,
        targetMonths: fund.targetMonths,
        ...(!funded && {
          cashCoverageMonths: avg ? pct1(Decimal.max(parts.cash, 0).div(avg)) : null,
        }),
      };
    }

    // ── Gastos por categoria (raiz) ──
    const rootIds = spendingRows.map((r) => r.root_id).filter((id): id is string => id !== null);
    const roots = rootIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: rootIds }, userId },
          select: { id: true, name: true, color: true, icon: true },
        })
      : [];
    const rootById = new Map(roots.map((c) => [c.id, c]));
    const spendItems: CategorySpend[] = spendingRows.map((r) => {
      const category = r.root_id ? rootById.get(r.root_id) : undefined;
      return category
        ? {
            categoryId: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            amount: dec(r.amount),
          }
        : { categoryId: null, ...UNCATEGORIZED, amount: dec(r.amount) };
    });
    const spendingByCategory = rollupSpending(spendItems);
    const topCategory = spendingByCategory.find((c) => c.categoryId !== null) ?? null;

    // ── Compromissos ──
    const c = commitmentRows[0];
    const cards = await this.cardsSummary(userId);
    const in30 = addDays(today, 30);
    const invoicesDue = cards.open.filter((i) => i.dueDate >= today && i.dueDate <= in30);
    const invoicesOverdue = cards.open.filter((i) => i.dueDate < today);
    const overdue = {
      count: Number(c?.overdue_count ?? 0) + invoicesOverdue.length,
      amount: dec(c?.overdue_amount).plus(
        invoicesOverdue.reduce((a, i) => a.plus(i.remaining), new Decimal(0)),
      ),
    };
    const nextCardDue = cards.open.find((i) => i.dueDate >= today) ?? cards.open[0] ?? null;

    return {
      month,
      netWorth: {
        current: toMoneyString(parts.netWorth),
        assets: toMoneyString(parts.assets),
        liabilities: toMoneyString(parts.liabilities),
        changeAmount12m: toMoneyString(changeAmount),
        change12m: base.value.greaterThan(0) ? pct1(changeAmount.div(base.value).times(100)) : null,
      },
      cash: { available: toMoneyString(parts.cash) },
      cards: {
        totalUsed: toMoneyString(cards.debt),
        totalLimit: toMoneyString(cards.totalLimit),
        nextDue: nextCardDue
          ? {
              cardId: nextCardDue.cardId,
              referenceMonth: nextCardDue.referenceMonth,
              dueDate: nextCardDue.dueDate,
              remaining: toMoneyString(nextCardDue.remaining),
            }
          : null,
      },
      investments: { total: toMoneyString(parts.investments) },
      flow: {
        income: toMoneyString(flow.income),
        expense: toMoneyString(flow.expense),
        net: toMoneyString(flow.income.minus(flow.expense)),
        pendingIncome: toMoneyString(flow.pendingIncome),
        pendingExpense: toMoneyString(flow.pendingExpense),
        previousIncome: toMoneyString(previous.income),
        previousExpense: toMoneyString(previous.expense),
      },
      emergencyFund,
      commitments: {
        next30Days: toMoneyString(
          dec(c?.next_amount)
            .plus(dec(monthlyPayments._sum.monthlyPayment))
            .plus(invoicesDue.reduce((a, i) => a.plus(i.remaining), new Decimal(0))),
        ),
        pendingCount: Number(c?.next_count ?? 0),
        overdueCount: overdue.count,
        overdueAmount: toMoneyString(overdue.amount),
      },
      series: {
        netWorthMethod: series.usedSnapshots ? 'snapshots' : 'reconstructed',
        netWorth: points.map((p) => ({ month: p.month, value: toMoneyString(p.value) })),
        cashflow: monthRange(month, 6).map((m) => ({
          month: m,
          income: toMoneyString(flowOf(flows, m).income),
          expense: toMoneyString(flowOf(flows, m).expense),
        })),
        spendingByCategory,
        investments: (await this.investments.portfolioSeries(userId, 12, month)).map((p) => ({
          month: p.month,
          value: p.value,
        })),
      },
      goals: goals.map((g) => {
        // Mesmo cálculo do módulo de metas (requiredMonthly arredondado para cima).
        const math = goalMath({
          today,
          targetAmount: dec(g.targetAmount),
          currentAmount: dec(g.currentAmount),
          targetDate: g.targetDate ? fromDbDate(g.targetDate) : null,
          monthlyContribution: g.monthlyContribution ? dec(g.monthlyContribution) : null,
          recentMonthlyAverage: null,
        });
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          currentAmount: toMoneyString(g.currentAmount),
          targetAmount: toMoneyString(g.targetAmount),
          targetDate: g.targetDate ? fromDbDate(g.targetDate) : null,
          progress: math.progress,
          monthlyContributionNeeded: math.requiredMonthly,
          status: g.status,
        };
      }),
      upcoming: upcoming.map(toTransactionDto),
      recent: recent.map(toTransactionDto),
      insights: buildInsights({
        currency: user.currency,
        income: flow.income,
        expense: flow.expense,
        previousExpense: previous.expense,
        emergency: emergencyForInsight,
        topCategory: topCategory ? { name: topCategory.name, share: topCategory.share } : null,
        overdue,
      }),
    };
  }
}
