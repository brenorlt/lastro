import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
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
import {
  Decimal,
  decimalFrom,
  formatMoney,
  toDecimal,
  toMoneyString,
} from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Budget, Category } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  budgetLevel,
  budgetPercent,
  overlaps,
  spentByCategory,
  thresholdsToFire,
  unbudgetedSpent,
} from './budget.calc.js';
import type {
  BudgetDto,
  BudgetsMetaDto,
  BudgetSuggestionDto,
  CopyResultDto,
  CreateBudgetDto,
} from './budget.dto.js';

type CategoryRef = Pick<Category, 'id' | 'name' | 'icon' | 'color' | 'parentId'>;
type BudgetWithCategory = Budget & { category: CategoryRef };

const CATEGORY_SELECT = { id: true, name: true, icon: true, color: true, parentId: true } as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async currentMonth(userId: string): Promise<YearMonth> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return yearMonthOf(todayIn(user?.timezone ?? 'America/Sao_Paulo'));
  }

  async list(
    userId: string,
    month?: YearMonth,
  ): Promise<{ data: BudgetDto[]; meta: BudgetsMetaDto }> {
    const target = month ?? (await this.currentMonth(userId));
    const [budgets, spend, parents] = await Promise.all([
      this.budgetsOf(userId, target),
      this.spendByCategory(userId, target),
      this.parentMap(userId),
    ]);
    const categoryIds = budgets.map((b) => b.categoryId);
    const spent = spentByCategory(categoryIds, spend, parents);
    const data = budgets
      .map((b) => this.toDto(b, spent.get(b.categoryId) ?? new Decimal(0)))
      .sort((a, b) => b.percent - a.percent || a.category.name.localeCompare(b.category.name));

    const totalLimit = budgets.reduce((acc, b) => acc.plus(b.limitAmount), new Decimal(0));
    const totalSpent = [...spent.values()].reduce((acc, v) => acc.plus(v), new Decimal(0));
    const { unbudgeted, uncategorized } = unbudgetedSpent(categoryIds, spend, parents);
    return {
      data,
      meta: {
        month: target,
        totalLimit: toMoneyString(totalLimit),
        totalSpent: toMoneyString(totalSpent),
        remaining: toMoneyString(totalLimit.minus(totalSpent)),
        percent: budgetPercent(totalSpent, totalLimit),
        unbudgetedSpent: toMoneyString(unbudgeted),
        uncategorizedSpent: toMoneyString(uncategorized),
      },
    };
  }

  /** Sugestões: raízes de DESPESA com gasto nos 3 meses completos anteriores e sem orçamento. */
  async suggestions(userId: string, month?: YearMonth): Promise<BudgetSuggestionDto[]> {
    const target = month ?? (await this.currentMonth(userId));
    const window = monthRange(addMonthsYm(target, -1), 3);
    const [rows, budgets, roots] = await Promise.all([
      this.prisma.$queryRaw<{ root_id: string; month: string; amount: unknown }[]>`
        SELECT COALESCE(c.parent_id, c.id)::text AS root_id, to_char(t.date, 'YYYY-MM') AS month,
               SUM(t.amount) AS amount
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = ${userId}::uuid AND t.deleted_at IS NULL AND t.type = 'EXPENSE'
          AND t.date >= ${monthStart(window[0])}::date AND t.date <= ${monthEnd(window[2])}::date
        GROUP BY 1, 2`,
      this.budgetsOf(userId, target),
      this.prisma.category.findMany({
        where: { userId, deletedAt: null, parentId: null, type: 'EXPENSE' },
        select: CATEGORY_SELECT,
      }),
    ]);
    const budgeted = new Set(budgets.map((b) => b.category.parentId ?? b.categoryId));
    const totals = new Map<string, { total: Decimal; last: Decimal }>();
    for (const row of rows) {
      const entry = totals.get(row.root_id) ?? { total: new Decimal(0), last: new Decimal(0) };
      entry.total = entry.total.plus(decimalFrom(row.amount));
      if (row.month === window[2]) entry.last = entry.last.plus(decimalFrom(row.amount));
      totals.set(row.root_id, entry);
    }
    return roots
      .filter((c) => totals.get(c.id)?.total.greaterThan(0) && !budgeted.has(c.id))
      .map((c) => {
        const t = totals.get(c.id) ?? { total: new Decimal(0), last: new Decimal(0) };
        return { category: c, average: t.total.div(3), last: t.last };
      })
      .sort((a, b) => b.average.comparedTo(a.average))
      .slice(0, 10)
      .map((s) => ({
        category: s.category,
        averageSpent: toMoneyString(s.average),
        lastMonthSpent: toMoneyString(s.last),
      }));
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetDto> {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, userId, deletedAt: null },
      select: { ...CATEGORY_SELECT, type: true },
    });
    if (!category) throw new AppException(ErrorCode.CATEGORY_NOT_FOUND);
    if (category.type !== 'EXPENSE') {
      throw new AppException(ErrorCode.CATEGORY_TYPE_MISMATCH, {
        message: 'Orçamentos só podem ser criados para categorias de despesa',
      });
    }
    const existing = await this.budgetsOf(userId, dto.month);
    if (existing.some((b) => b.categoryId === category.id)) {
      throw new AppException(ErrorCode.BUDGET_ALREADY_EXISTS);
    }
    if (
      overlaps(
        category,
        existing.map((b) => b.category),
      )
    ) {
      throw new AppException(ErrorCode.BUDGET_OVERLAP);
    }

    const limit = toDecimal(dto.limitAmount);
    const spent = await this.spentFor(userId, category.id, dto.month);
    // Gasto já existente não gera alerta retroativo: limiares atingidos nascem "disparados".
    const initialFired = thresholdsToFire(
      [50, 80, 100],
      [],
      budgetPercent(spent, limit),
    ).newlyFired;
    try {
      const budget = await this.prisma.budget.create({
        data: {
          userId,
          categoryId: category.id,
          month: toDbDate(monthStart(dto.month)),
          limitAmount: limit,
          firedThresholds: initialFired,
        },
        include: { category: { select: CATEGORY_SELECT } },
      });
      return this.toDto(budget, spent);
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.BUDGET_ALREADY_EXISTS) : error;
    }
  }

  async update(userId: string, id: string, limitAmount: string): Promise<BudgetDto> {
    const budget = await this.findOwned(userId, id);
    const updated = await this.prisma.budget.update({
      where: { id: budget.id },
      data: { limitAmount: toDecimal(limitAmount) },
      include: { category: { select: CATEGORY_SELECT } },
    });
    const month = yearMonthOf(fromDbDate(updated.month));
    await this.evaluateAlerts(userId, [month]);
    return this.toDto(updated, await this.spentFor(userId, updated.categoryId, month));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.budget.delete({ where: { id } });
  }

  /** Copia limites de um mês para outro, pulando categorias já orçadas ou sobrepostas. */
  async copy(userId: string, fromMonth: YearMonth, toMonth: YearMonth): Promise<CopyResultDto> {
    const [source, target] = await Promise.all([
      this.budgetsOf(userId, fromMonth),
      this.budgetsOf(userId, toMonth),
    ]);
    const active = await this.prisma.category.findMany({
      where: { userId, deletedAt: null, id: { in: source.map((b) => b.categoryId) } },
      select: { id: true },
    });
    const alive = new Set(active.map((c) => c.id));
    const taken = [...target.map((b) => b.category)];
    let created = 0;
    let skipped = 0;
    for (const budget of source) {
      if (
        !alive.has(budget.categoryId) ||
        taken.some((c) => c.id === budget.categoryId) ||
        overlaps(budget.category, taken)
      ) {
        skipped += 1;
        continue;
      }
      const spent = await this.spentFor(userId, budget.categoryId, toMonth);
      await this.prisma.budget.create({
        data: {
          userId,
          categoryId: budget.categoryId,
          month: toDbDate(monthStart(toMonth)),
          limitAmount: budget.limitAmount,
          alertThresholds: budget.alertThresholds,
          firedThresholds: thresholdsToFire(
            budget.alertThresholds,
            [],
            budgetPercent(spent, budget.limitAmount),
          ).newlyFired,
        },
      });
      taken.push(budget.category);
      created += 1;
    }
    return { created, skipped };
  }

  /**
   * Reavalia os orçamentos dos meses afetados e notifica limiares cruzados para cima
   * (uma vez por orçamento/limiar). Chamado após gravações de despesas; nunca lança.
   */
  async evaluateAlerts(userId: string, months: YearMonth[]): Promise<number> {
    let created = 0;
    try {
      const unique = [...new Set(months)];
      const enabled = await this.notifications.isEnabled(userId, 'budgetAlerts');
      const parents = unique.length
        ? await this.parentMap(userId)
        : new Map<string, string | null>();
      for (const month of unique) {
        const budgets = await this.budgetsOf(userId, month);
        if (!budgets.length) continue;
        const spent = spentByCategory(
          budgets.map((b) => b.categoryId),
          await this.spendByCategory(userId, month),
          parents,
        );
        for (const budget of budgets) {
          const amount = spent.get(budget.categoryId) ?? new Decimal(0);
          const percent = budgetPercent(amount, budget.limitAmount);
          const { newlyFired, notify } = thresholdsToFire(
            budget.alertThresholds,
            budget.firedThresholds,
            percent,
          );
          if (!newlyFired.length) continue;
          // Condicional: requisições concorrentes não notificam o mesmo limiar duas vezes.
          const { count } = await this.prisma.budget.updateMany({
            where: { id: budget.id, firedThresholds: { equals: budget.firedThresholds } },
            data: {
              firedThresholds: [...budget.firedThresholds, ...newlyFired].sort((a, b) => a - b),
            },
          });
          if (count !== 1 || notify === null || !enabled) continue;
          const sent = await this.notifications.notify(
            userId,
            this.alertMessage(budget, month, notify, percent, amount),
            { topic: 'budgetAlerts', dedupeKey: `budget:${budget.id}:${notify}` },
          );
          if (sent) created += 1;
        }
      }
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Falha ao avaliar alertas de orçamento',
      );
    }
    return created;
  }

  private alertMessage(
    budget: BudgetWithCategory,
    month: YearMonth,
    threshold: number,
    percent: number,
    spent: Decimal,
  ) {
    const name = budget.category.name;
    const exceeded = threshold >= 100;
    return {
      type: exceeded ? ('BUDGET_EXCEEDED' as const) : ('BUDGET_THRESHOLD' as const),
      title: exceeded
        ? `Orçamento de ${name} excedido`
        : `${name} atingiu ${threshold}% do orçamento`,
      body: `Você gastou ${formatMoney(spent)} de ${formatMoney(budget.limitAmount)} (${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(percent)}%) em ${month.slice(5)}/${month.slice(0, 4)}.`,
      data: { budgetId: budget.id, month, threshold, percent, href: '/orcamento' },
    };
  }

  private toDto(budget: BudgetWithCategory, spent: Decimal): BudgetDto {
    const limit = new Decimal(budget.limitAmount);
    const percent = budgetPercent(spent, limit);
    return {
      id: budget.id,
      month: yearMonthOf(fromDbDate(budget.month)),
      category: budget.category,
      limitAmount: toMoneyString(limit),
      spent: toMoneyString(spent),
      remaining: toMoneyString(limit.minus(spent)),
      percent,
      level: budgetLevel(percent),
      alertThresholds: budget.alertThresholds,
    };
  }

  private budgetsOf(userId: string, month: YearMonth): Promise<BudgetWithCategory[]> {
    return this.prisma.budget.findMany({
      where: { userId, month: toDbDate(monthStart(month)) },
      include: { category: { select: CATEGORY_SELECT } },
    });
  }

  /** Despesas do mês (CLEARED + PENDING) por categoria — um único groupBy. */
  private async spendByCategory(
    userId: string,
    month: YearMonth,
  ): Promise<Map<string | null, Decimal>> {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        deletedAt: null,
        type: 'EXPENSE',
        date: { gte: toDbDate(monthStart(month)), lte: toDbDate(monthEnd(month)) },
      },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.categoryId, decimalFrom(r._sum.amount)]));
  }

  private async spentFor(userId: string, categoryId: string, month: YearMonth): Promise<Decimal> {
    const [spend, parents] = await Promise.all([
      this.spendByCategory(userId, month),
      this.parentMap(userId),
    ]);
    return spentByCategory([categoryId], spend, parents).get(categoryId) ?? new Decimal(0);
  }

  private async parentMap(userId: string): Promise<Map<string, string | null>> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    return new Map(categories.map((c) => [c.id, c.parentId]));
  }

  private async findOwned(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new AppException(ErrorCode.BUDGET_NOT_FOUND);
    return budget;
  }
}
