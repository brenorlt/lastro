import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  addMonthsYm,
  type DateOnly,
  fromDbDate,
  monthEnd,
  monthStart,
  todayIn,
  type YearMonth,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom, formatMoney, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BudgetsService } from '../budgets/budgets.service.js';
import { monthLabel } from '../cards/invoice.calc.js';
import { GoalsService } from '../goals/goals.service.js';
import { InvestmentsService } from '../investments/investments.service.js';
import { NetWorthService } from '../net-worth/net-worth.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { buildCsv } from './csv.js';
import { renderPdf } from './pdf.js';
import {
  effectiveGranularity,
  enumeratePeriods,
  monthsSpanned,
  periodKey,
  previousWindow,
  resolveRange,
} from './report-period.js';
import { date, int, money, percent, type ReportTable, text } from './report-table.js';
import type {
  BudgetReportQueryDto,
  CashFlowQueryDto,
  ExportQueryDto,
  ReportFiltersDto,
  ReportKind,
  ReportTransactionsQueryDto,
} from './reports.dto.js';
import { buildCategoryReport, type CategoryMeta, type CategoryRow } from './reports.calc.js';

const pct1 = (v: Decimal) => Number(v.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));
const br = (d: DateOnly) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const MAX_EXPORT_ROWS = 10_000;
const INVESTMENT_DISCLAIMER =
  'Valores de mercado conforme informados; não constituem recomendação de investimento.';

interface UserCtx {
  today: DateOnly;
  timezone: string;
  currency: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly netWorthService: NetWorthService,
    private readonly investments: InvestmentsService,
    private readonly goals: GoalsService,
    private readonly budgets: BudgetsService,
  ) {}

  // ─────────────────────────── Relatórios ───────────────────────────

  async cashFlow(userId: string, query: CashFlowQueryDto) {
    const ctx = await this.ctx(userId);
    const { from, to } = resolveRange(query.from, query.to, ctx.today);
    const granularity = effectiveGranularity(query.granularity ?? 'month', from, to);
    const where = await this.where(userId, query, from, to);
    const grouped = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where,
      _sum: { amount: true },
    });

    const buckets = new Map<string, { income: Decimal; expense: Decimal }>();
    for (const g of grouped) {
      const key = periodKey(fromDbDate(g.date), granularity);
      const entry = buckets.get(key) ?? { income: new Decimal(0), expense: new Decimal(0) };
      if (g.type === 'INCOME') entry.income = entry.income.plus(decimalFrom(g._sum.amount));
      if (g.type === 'EXPENSE') entry.expense = entry.expense.plus(decimalFrom(g._sum.amount));
      buckets.set(key, entry);
    }
    let cumulative = new Decimal(0);
    let income = new Decimal(0);
    let expense = new Decimal(0);
    const rows = enumeratePeriods(from, to, granularity).map((p) => {
      const b = buckets.get(p.period) ?? { income: new Decimal(0), expense: new Decimal(0) };
      const net = b.income.minus(b.expense);
      cumulative = cumulative.plus(net);
      income = income.plus(b.income);
      expense = expense.plus(b.expense);
      return {
        period: p.period,
        label: p.label,
        income: toMoneyString(b.income),
        expense: toMoneyString(b.expense),
        net: toMoneyString(net),
        cumulative: toMoneyString(cumulative),
      };
    });
    const months = monthsSpanned(from, to);
    return {
      from,
      to,
      granularity,
      rows,
      totals: {
        income: toMoneyString(income),
        expense: toMoneyString(expense),
        net: toMoneyString(income.minus(expense)),
        averageMonthlyIncome: toMoneyString(income.div(months)),
        averageMonthlyExpense: toMoneyString(expense.div(months)),
        savingsRate: income.greaterThan(0)
          ? pct1(income.minus(expense).div(income).times(100))
          : null,
      },
    };
  }

  async categories(userId: string, query: ReportFiltersDto) {
    const ctx = await this.ctx(userId);
    const { from, to } = resolveRange(query.from, query.to, ctx.today);
    const prev = previousWindow(from, to);
    const type = query.type ?? 'EXPENSE';
    const group = async (a: DateOnly, b: DateOnly) => {
      const where = await this.where(userId, { ...query, type }, a, b);
      const rows = await this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      });
      return new Map(
        rows.map((r) => [
          r.categoryId,
          { amount: decimalFrom(r._sum.amount), count: r._count._all },
        ]),
      );
    };
    const [current, previous, categories] = await Promise.all([
      group(from, to),
      group(prev.from, prev.to),
      this.prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true, color: true, icon: true, parentId: true },
      }),
    ]);
    const report = buildCategoryReport(
      current,
      previous,
      new Map(categories.map((c): [string, CategoryMeta] => [c.id, c])),
    );
    return { from, to, type, previousFrom: prev.from, previousTo: prev.to, ...report };
  }

  async transactionsReport(userId: string, query: ReportTransactionsQueryDto) {
    const ctx = await this.ctx(userId);
    const { from, to } = resolveRange(query.from, query.to, ctx.today);
    const result = await this.transactions.list(userId, {
      ...query,
      from,
      to,
      pageSize: query.pageSize ?? 100,
    });
    return { ...result, meta: { ...result.meta, from, to } };
  }

  async netWorth(userId: string, months = 12) {
    const nw = await this.netWorthService.get(userId, months);
    return {
      rows: nw.series,
      netWorth: nw.netWorth,
      assets: nw.assets,
      liabilities: nw.liabilities,
      debtRatio: nw.debtRatio,
      change12m: nw.change12m,
      method: nw.seriesMethod,
    };
  }

  async investmentsReport(userId: string) {
    const [list, series] = await Promise.all([
      this.investments.list(userId),
      this.investments.portfolioSeries(userId, 12),
    ]);
    return {
      totals: {
        invested: list.meta.totalInvested,
        current: list.meta.totalCurrent,
        income: list.meta.totalIncome,
        profit: list.meta.profit,
        profitPercent: list.meta.profitPercent,
        brokerCash: list.meta.unallocatedBrokerCash,
      },
      byClass: list.meta.byClass,
      positions: list.data,
      contributionsByMonth: series.map((p) => ({ month: p.month, amount: p.contributions })),
    };
  }

  async goalsReport(userId: string) {
    const { data, meta } = await this.goals.list(userId, {});
    return {
      rows: data,
      totals: { target: meta.totalTarget, saved: meta.totalSaved, count: meta.count },
    };
  }

  async budget(userId: string, query: BudgetReportQueryDto) {
    const ctx = await this.ctx(userId);
    const current = yearMonthOf(ctx.today);
    const fromMonth = query.fromMonth ?? query.toMonth ?? current;
    const toMonth = query.toMonth ?? query.fromMonth ?? current;
    if (fromMonth > toMonth) this.fail('fromMonth', 'O mês inicial deve ser anterior ao final');
    const months: YearMonth[] = [];
    for (let m = fromMonth; m <= toMonth; m = addMonthsYm(m, 1)) {
      months.push(m);
      if (months.length > 24) this.fail('toMonth', 'O período máximo é de 24 meses');
    }
    const results = await Promise.all(months.map((m) => this.budgets.list(userId, m)));
    return {
      fromMonth,
      toMonth,
      months: results.map((r) => ({
        month: r.meta.month,
        totalLimit: r.meta.totalLimit,
        totalSpent: r.meta.totalSpent,
        percent: r.meta.percent,
        items: r.data.map((b) => ({
          category: b.category,
          limitAmount: b.limitAmount,
          spent: b.spent,
          percent: b.percent,
          level: b.level,
        })),
      })),
    };
  }

  // ─────────────────────────── Exportação ───────────────────────────

  async export(userId: string, kind: ReportKind, query: ExportQueryDto) {
    const ctx = await this.ctx(userId);
    const table = await this.table(userId, kind, query, ctx);
    const format = query.format ?? 'csv';
    const range = table.fileRange;
    const filename = `lastro-${kind}-${range.from}_${range.to}.${format}`;
    if (format === 'csv') {
      return {
        filename,
        contentType: 'text/csv; charset=utf-8',
        body: Buffer.from(buildCsv(table), 'utf8'),
      };
    }
    const generatedAt = `${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: ctx.timezone,
    }).format(new Date())} (${ctx.timezone})`;
    return {
      filename,
      contentType: 'application/pdf',
      body: await renderPdf(table, { generatedAt, currency: ctx.currency }),
    };
  }

  private async table(
    userId: string,
    kind: ReportKind,
    q: ExportQueryDto,
    ctx: UserCtx,
  ): Promise<ReportTable & { fileRange: { from: string; to: string } }> {
    const money$ = (v: string) => formatMoney(v, ctx.currency);
    const filters = await this.filterLabels(userId, q);
    switch (kind) {
      case 'cash-flow': {
        const r = await this.cashFlow(userId, q);
        return {
          kind,
          title: 'Fluxo de caixa',
          periodLabel: `${br(r.from)} a ${br(r.to)} (${{ day: 'diário', week: 'semanal', month: 'mensal' }[r.granularity]})`,
          filters,
          fileRange: { from: r.from, to: r.to },
          summary: [
            ['Receitas', money$(r.totals.income)],
            ['Despesas', money$(r.totals.expense)],
            ['Resultado', money$(r.totals.net)],
            [
              'Taxa de poupança',
              r.totals.savingsRate === null
                ? '—'
                : `${String(r.totals.savingsRate).replace('.', ',')}%`,
            ],
          ],
          columns: [
            { header: 'Período', width: 1.4, align: 'left' },
            { header: 'Receitas' },
            { header: 'Despesas' },
            { header: 'Saldo' },
            { header: 'Acumulado' },
          ],
          rows: r.rows.map((row) => [
            text(row.label),
            money(row.income),
            money(row.expense),
            money(row.net),
            money(row.cumulative),
          ]),
        };
      }
      case 'categories': {
        const r = await this.categories(userId, q);
        const flat: CategoryRow[] = r.rows.flatMap((row) => [
          row,
          ...(row.children ?? []).map((c) => ({ ...c, name: `${row.name} › ${c.name}` })),
        ]);
        return {
          kind,
          title: r.type === 'INCOME' ? 'Receitas por categoria' : 'Despesas por categoria',
          periodLabel: `${br(r.from)} a ${br(r.to)} (comparado a ${br(r.previousFrom)} a ${br(r.previousTo)})`,
          filters,
          fileRange: { from: r.from, to: r.to },
          summary: [['Total', money$(r.total)]],
          columns: [
            { header: 'Categoria', width: 2.4, align: 'left' },
            { header: 'Valor', width: 1.2 },
            { header: 'Part. %', width: 0.8 },
            { header: 'Lançamentos', width: 0.9 },
            { header: 'Período anterior', width: 1.2 },
            { header: 'Variação %', width: 0.9 },
          ],
          rows: flat.map((c) => [
            text(c.name),
            money(c.amount),
            percent(c.share),
            int(c.count),
            money(c.previousAmount),
            percent(c.change),
          ]),
        };
      }
      case 'transactions': {
        const { from, to } = resolveRange(q.from, q.to, ctx.today);
        const rows = [];
        let totals = null;
        for (let page = 1; rows.length < MAX_EXPORT_ROWS; page++) {
          const r = await this.transactionsReport(userId, { ...q, from, to, page, pageSize: 500 });
          rows.push(...r.data);
          totals = r.meta.totals;
          if (page >= r.meta.totalPages) break;
        }
        const typeLabel = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' };
        return {
          kind,
          title: 'Lançamentos',
          periodLabel: `${br(from)} a ${br(to)}`,
          filters,
          fileRange: { from, to },
          summary: totals
            ? [
                ['Receitas', money$(totals.income)],
                ['Despesas', money$(totals.expense)],
                ['Resultado', money$(totals.net)],
                ['Lançamentos', String(rows.length)],
              ]
            : [],
          columns: [
            { header: 'Data', width: 0.9, align: 'left' },
            { header: 'Descrição', width: 2.4, align: 'left' },
            { header: 'Tipo', width: 1, align: 'left' },
            { header: 'Categoria', width: 1.4, align: 'left' },
            { header: 'Conta/Cartão', width: 1.4, align: 'left' },
            { header: 'Status', width: 0.9, align: 'left' },
            { header: 'Valor', width: 1.1, align: 'right' },
          ],
          rows: rows.map((t) => [
            date(t.date),
            text(t.description),
            text(typeLabel[t.type]),
            text(t.category?.name ?? null),
            text(t.creditCard?.name ?? t.account?.name ?? t.transferAccount?.name ?? null),
            text(t.status === 'CLEARED' ? 'Confirmado' : 'Pendente'),
            money(t.amount),
          ]),
        };
      }
      case 'net-worth': {
        const r = await this.netWorth(userId, q.months ?? 12);
        const first = r.rows[0]?.month ?? yearMonthOf(ctx.today);
        return {
          kind,
          title: 'Evolução do patrimônio',
          periodLabel: `${monthLabel(first)} a ${monthLabel(yearMonthOf(ctx.today))}`,
          filters: [],
          fileRange: { from: monthStart(first), to: ctx.today },
          summary: [
            ['Patrimônio', money$(r.netWorth)],
            ['Ativos', money$(r.assets.total)],
            ['Passivos', money$(r.liabilities.total)],
            [
              'Endividamento',
              r.debtRatio === null ? '—' : `${String(r.debtRatio).replace('.', ',')}%`,
            ],
          ],
          columns: [
            { header: 'Mês', align: 'left' },
            { header: 'Ativos' },
            { header: 'Passivos' },
            { header: 'Patrimônio' },
          ],
          rows: r.rows.map((p) => [
            text(monthLabel(p.month)),
            money(p.assets),
            money(p.liabilities),
            money(p.netWorth),
          ]),
        };
      }
      case 'investments': {
        const r = await this.investmentsReport(userId);
        return {
          kind,
          title: 'Carteira de investimentos',
          periodLabel: `Posição em ${br(ctx.today)}`,
          filters: [],
          fileRange: { from: ctx.today, to: ctx.today },
          summary: [
            ['Investido', money$(r.totals.invested)],
            ['Valor atual', money$(r.totals.current)],
            ['Rendimentos', money$(r.totals.income)],
            ['Lucro', money$(r.totals.profit)],
          ],
          columns: [
            { header: 'Nome', width: 2, align: 'left' },
            { header: 'Ticker', width: 0.8, align: 'left' },
            { header: 'Classe', width: 1, align: 'left' },
            { header: 'Investido', width: 1.1 },
            { header: 'Atual', width: 1.1 },
            { header: 'Lucro', width: 1.1 },
            { header: 'Lucro %', width: 0.7 },
            { header: 'Alocação %', width: 0.8 },
          ],
          rows: r.positions.map((p) => [
            text(p.name),
            text(p.ticker),
            text(p.type),
            money(p.investedAmount),
            money(p.currentValue),
            money(p.profit),
            percent(p.profitPercent),
            percent(p.allocationPercent),
          ]),
          disclaimer: INVESTMENT_DISCLAIMER,
        };
      }
      case 'goals': {
        const r = await this.goalsReport(userId);
        const status = {
          ACTIVE: 'Ativa',
          COMPLETED: 'Concluída',
          PAUSED: 'Pausada',
          ARCHIVED: 'Arquivada',
        } as Record<string, string>;
        return {
          kind,
          title: 'Metas',
          periodLabel: `Posição em ${br(ctx.today)}`,
          filters: [],
          fileRange: { from: ctx.today, to: ctx.today },
          summary: [
            ['Alvo total', money$(r.totals.target)],
            ['Guardado', money$(r.totals.saved)],
            ['Metas', String(r.totals.count)],
          ],
          columns: [
            { header: 'Meta', width: 2, align: 'left' },
            { header: 'Status', width: 0.9, align: 'left' },
            { header: 'Alvo', width: 1.1 },
            { header: 'Guardado', width: 1.1 },
            { header: 'Progresso %', width: 0.9 },
            { header: 'Data-alvo', width: 1, align: 'right' },
            { header: 'Mensal necessário', width: 1.2 },
          ],
          rows: r.rows.map((g) => [
            text(g.name),
            text(status[g.status] ?? g.status),
            money(g.targetAmount),
            money(g.currentAmount),
            percent(g.progress),
            date(g.targetDate),
            g.requiredMonthly ? money(g.requiredMonthly) : text(null),
          ]),
        };
      }
      case 'budget': {
        const r = await this.budget(userId, q);
        const level = {
          OK: 'OK',
          ATTENTION: 'Atenção',
          WARNING: 'Alerta',
          EXCEEDED: 'Excedido',
        } as Record<string, string>;
        return {
          kind,
          title: 'Orçamentos',
          periodLabel: `${monthLabel(r.fromMonth)} a ${monthLabel(r.toMonth)}`,
          filters: [],
          fileRange: { from: monthStart(r.fromMonth), to: monthEnd(r.toMonth) },
          summary: r.months.map((m) => [
            monthLabel(m.month),
            `${money$(m.totalSpent)} de ${money$(m.totalLimit)}`,
          ]),
          columns: [
            { header: 'Mês', width: 0.9, align: 'left' },
            { header: 'Categoria', width: 1.8, align: 'left' },
            { header: 'Limite', width: 1.1 },
            { header: 'Gasto', width: 1.1 },
            { header: '%', width: 0.7 },
            { header: 'Nível', width: 0.9, align: 'left' },
          ],
          rows: r.months.flatMap((m) =>
            m.items.map((i) => [
              text(monthLabel(m.month)),
              text(i.category.name),
              money(i.limitAmount),
              money(i.spent),
              percent(i.percent),
              text(level[i.level] ?? i.level),
            ]),
          ),
        };
      }
    }
  }

  // ─────────────────────────── Internos ───────────────────────────

  /** Mesmo `where` da listagem de lançamentos (transferências fora de receitas/despesas). */
  private async where(
    userId: string,
    q: ReportFiltersDto,
    from: DateOnly,
    to: DateOnly,
  ): Promise<Prisma.TransactionWhereInput> {
    const where = await this.transactions.buildWhere(userId, {
      from,
      to,
      type: q.type,
      accountId: q.accountId,
      creditCardId: q.creditCardId,
      categoryId: q.categoryId,
    });
    if (!q.type) where.type = { in: ['INCOME', 'EXPENSE'] };
    return where;
  }

  private async filterLabels(userId: string, q: ReportFiltersDto): Promise<string[]> {
    const labels: string[] = [];
    if (q.accountId) {
      const a = await this.prisma.account.findFirst({
        where: { id: q.accountId, userId },
        select: { name: true },
      });
      labels.push(`Conta: ${a?.name ?? '—'}`);
    }
    if (q.creditCardId) {
      const c = await this.prisma.creditCard.findFirst({
        where: { id: q.creditCardId, userId },
        select: { name: true },
      });
      labels.push(`Cartão: ${c?.name ?? '—'}`);
    }
    if (q.categoryId) {
      const c = await this.prisma.category.findFirst({
        where: { id: q.categoryId, userId },
        select: { name: true },
      });
      labels.push(`Categoria: ${c?.name ?? '—'} (com subcategorias)`);
    }
    if (q.type) labels.push(`Tipo: ${q.type === 'INCOME' ? 'Receitas' : 'Despesas'}`);
    return labels;
  }

  private async ctx(userId: string): Promise<UserCtx> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true, currency: true },
    });
    return { today: todayIn(user.timezone), timezone: user.timezone, currency: user.currency };
  }

  private fail(field: string, message: string): never {
    throw new AppException(ErrorCode.VALIDATION_ERROR, { details: [{ field, message }] });
  }
}
