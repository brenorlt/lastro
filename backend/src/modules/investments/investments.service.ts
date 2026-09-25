import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  type DateOnly,
  fromDbDate,
  monthRange,
  todayIn,
  toDbDate,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Investment, InvestmentTransaction, Prisma } from '../../generated/prisma/client.js';
import type { InvestmentTransactionType, InvestmentType } from '../../generated/prisma/enums.js';
import { createCashMovement, deleteCashMovement } from '../transactions/cash-movement.js';
import type {
  CreateInvestmentDto,
  CreateInvestmentTxDto,
  InvestmentDetailDto,
  InvestmentDto,
  InvestmentTxDto,
  PortfolioSeriesPointDto,
  UpdateInvestmentDto,
} from './investment.dto.js';
import {
  type EngineTx,
  InsufficientPositionError,
  monthlySeries,
  type PositionState,
  profitOf,
  replay,
} from './investment.engine.js';

type Tx = Prisma.TransactionClient;
type TxRow = InvestmentTransaction & { account: { id: string; name: string } | null };

const qty = (v: Decimal | null) => (v === null ? null : v.toFixed(8));
const pct1 = (v: Decimal) => Number(v.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));

function toEngine(row: InvestmentTransaction): EngineTx {
  return {
    type: row.type,
    amount: new Decimal(row.amount),
    quantity: row.quantity ? new Decimal(row.quantity) : null,
    date: fromDbDate(row.date),
    createdAt: row.createdAt,
  };
}

const CASH_DESCRIPTION: Record<InvestmentTransactionType, string> = {
  BUY: 'Aporte',
  SELL: 'Resgate',
  DIVIDEND: 'Dividendos',
  INTEREST: 'Juros',
  FEE: 'Taxa',
  VALUATION: '',
};

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, type?: InvestmentType) {
    const rows = await this.prisma.investment.findMany({
      where: { userId, deletedAt: null, ...(type ? { type } : {}) },
      orderBy: [{ currentValue: 'desc' }, { createdAt: 'asc' }],
    });
    const [all, brokerCash] = await Promise.all([
      type
        ? this.prisma.investment.findMany({ where: { userId, deletedAt: null } })
        : Promise.resolve(rows),
      this.prisma.account.aggregate({
        where: { userId, deletedAt: null, status: 'ACTIVE', type: 'INVESTMENT' },
        _sum: { currentBalance: true },
      }),
    ]);
    const portfolioTotal = all.reduce((a, i) => a.plus(i.currentValue), new Decimal(0));
    const data = rows.map((r) => this.toDto(r, portfolioTotal));

    const totals = rows.reduce(
      (acc, r) => ({
        invested: acc.invested.plus(r.investedAmount),
        current: acc.current.plus(r.currentValue),
        income: acc.income.plus(r.income),
        realized: acc.realized.plus(r.realizedGain),
      }),
      {
        invested: new Decimal(0),
        current: new Decimal(0),
        income: new Decimal(0),
        realized: new Decimal(0),
      },
    );
    const { profit, profitPercent } = profitOf({
      currentValue: totals.current,
      investedAmount: totals.invested,
      income: totals.income,
      realizedGain: totals.realized,
    });
    const byType = new Map<InvestmentType, { current: Decimal; invested: Decimal }>();
    for (const r of rows) {
      const entry = byType.get(r.type) ?? { current: new Decimal(0), invested: new Decimal(0) };
      byType.set(r.type, {
        current: entry.current.plus(r.currentValue),
        invested: entry.invested.plus(r.investedAmount),
      });
    }
    return {
      data,
      meta: {
        totalInvested: toMoneyString(totals.invested),
        totalCurrent: toMoneyString(totals.current),
        totalIncome: toMoneyString(totals.income),
        profit: toMoneyString(profit),
        profitPercent,
        count: rows.length,
        byClass: [...byType.entries()]
          .sort((a, b) => b[1].current.comparedTo(a[1].current))
          .map(([t, v]) => ({
            type: t,
            current: toMoneyString(v.current),
            invested: toMoneyString(v.invested),
            share: totals.current.greaterThan(0)
              ? pct1(v.current.div(totals.current).times(100))
              : 0,
          })),
        unallocatedBrokerCash: toMoneyString(brokerCash._sum.currentBalance ?? 0),
      },
    };
  }

  async get(userId: string, id: string): Promise<InvestmentDetailDto> {
    const investment = await this.findOwned(userId, id);
    const today = await this.today(userId);
    const [txs, portfolio] = await Promise.all([
      this.prisma.investmentTransaction.findMany({
        where: { investmentId: id },
        include: { account: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.investment.aggregate({
        where: { userId, deletedAt: null },
        _sum: { currentValue: true },
      }),
    ]);
    return {
      ...this.toDto(investment, new Decimal(portfolio._sum.currentValue ?? 0)),
      transactions: txs.map((t) => this.toTxDto(t)),
      series: monthlySeries(txs.map(toEngine), monthRange(yearMonthOf(today), 12)).map((p) => ({
        month: p.month,
        value: toMoneyString(p.value),
        invested: toMoneyString(p.invested),
      })),
    };
  }

  /** Série da carteira: soma das séries de cada investimento (não excluído). */
  async portfolioSeries(
    userId: string,
    months = 12,
    endMonth?: string,
  ): Promise<PortfolioSeriesPointDto[]> {
    const today = await this.today(userId);
    const txs = await this.prisma.investmentTransaction.findMany({
      where: { userId, investment: { deletedAt: null } },
    });
    const range = monthRange(endMonth ?? yearMonthOf(today), months);
    const byInvestment = new Map<string, EngineTx[]>();
    for (const t of txs)
      byInvestment.set(t.investmentId, [...(byInvestment.get(t.investmentId) ?? []), toEngine(t)]);
    const totals = range.map((month) => ({
      month,
      value: new Decimal(0),
      invested: new Decimal(0),
      contributions: new Decimal(0),
    }));
    for (const list of byInvestment.values()) {
      monthlySeries(list, range).forEach((p, i) => {
        totals[i].value = totals[i].value.plus(p.value);
        totals[i].invested = totals[i].invested.plus(p.invested);
        totals[i].contributions = totals[i].contributions.plus(p.contributions);
      });
    }
    return totals.map((t) => ({
      month: t.month,
      value: toMoneyString(t.value),
      invested: toMoneyString(t.invested),
      contributions: toMoneyString(t.contributions),
    }));
  }

  async create(userId: string, dto: CreateInvestmentDto): Promise<InvestmentDto> {
    const today = await this.today(userId);
    this.assertNotFuture(dto.appliedAt, today, 'appliedAt');
    const quantity = dto.quantity ? new Decimal(dto.quantity) : null;
    const price = dto.averagePrice ? new Decimal(dto.averagePrice) : null;
    if (quantity?.lessThanOrEqualTo(0))
      this.fail('quantity', 'A quantidade deve ser maior que zero');
    const invested = dto.investedAmount
      ? toDecimal(dto.investedAmount)
      : quantity && price
        ? quantity.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : null;
    if (!invested || invested.lessThanOrEqualTo(0)) {
      this.fail('investedAmount', 'Informe o valor investido ou quantidade × preço');
    }
    const funding = dto.fundingAccountId
      ? await this.activeAccount(userId, dto.fundingAccountId)
      : null;

    const id = await this.prisma.$transaction(async (tx) => {
      const investment = await tx.investment.create({
        data: {
          userId,
          name: dto.name,
          ticker: dto.ticker || null,
          institution: dto.institution || null,
          type: dto.type,
          appliedAt: toDbDate(dto.appliedAt),
          maturityDate: dto.maturityDate ? toDbDate(dto.maturityDate) : null,
          liquidity: dto.liquidity,
          liquidityDays: dto.liquidityDays ?? null,
          notes: dto.notes ?? null,
        },
      });
      await this.insertTx(tx, userId, investment, {
        type: 'BUY',
        amount: invested,
        quantity,
        price,
        date: dto.appliedAt,
        note: 'Aplicação inicial',
        accountId: funding,
        description: `Aplicação: ${dto.name}`,
      });
      if (dto.currentValue && !toDecimal(dto.currentValue).equals(invested)) {
        await this.insertTx(tx, userId, investment, {
          type: 'VALUATION',
          amount: toDecimal(dto.currentValue),
          quantity: null,
          price: null,
          date: dto.appliedAt,
          note: 'Valor atual informado no cadastro',
          accountId: null,
        });
      }
      await this.recompute(tx, investment.id);
      return investment.id;
    });
    return this.getDto(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateInvestmentDto): Promise<InvestmentDto> {
    await this.findOwned(userId, id);
    if (dto.name === null || dto.type === null || dto.liquidity === null) {
      this.fail('name', 'name, type e liquidity não podem ser nulos');
    }
    await this.prisma.investment.update({
      where: { id },
      data: {
        name: dto.name,
        ticker: dto.ticker === undefined ? undefined : dto.ticker || null,
        institution: dto.institution === undefined ? undefined : dto.institution || null,
        type: dto.type,
        maturityDate:
          dto.maturityDate === undefined
            ? undefined
            : dto.maturityDate
              ? toDbDate(dto.maturityDate)
              : null,
        liquidity: dto.liquidity,
        liquidityDays: dto.liquidityDays === undefined ? undefined : dto.liquidityDays,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
    });
    return this.getDto(userId, id);
  }

  /** Soft delete: os lançamentos de caixa já gerados permanecem nas contas. */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.investment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addTransaction(
    userId: string,
    id: string,
    dto: CreateInvestmentTxDto,
  ): Promise<InvestmentDetailDto> {
    const investment = await this.findOwned(userId, id);
    const today = await this.today(userId);
    this.assertNotFuture(dto.date, today, 'date');
    const accountId = dto.accountId ? await this.activeAccount(userId, dto.accountId) : null;
    if (dto.type === 'VALUATION' && accountId)
      this.fail('accountId', 'Reavaliação não movimenta caixa');
    const quantity = dto.quantity ? new Decimal(dto.quantity) : null;
    if (quantity?.lessThanOrEqualTo(0))
      this.fail('quantity', 'A quantidade deve ser maior que zero');

    const categoryId =
      accountId && (dto.type === 'DIVIDEND' || dto.type === 'INTEREST')
        ? await this.defaultIncomeCategory(userId)
        : null;
    await this.prisma.$transaction(async (tx) => {
      await this.insertTx(tx, userId, investment, {
        type: dto.type,
        amount: toDecimal(dto.amount),
        quantity,
        price: dto.price ? new Decimal(dto.price) : null,
        date: dto.date,
        note: dto.note ?? null,
        accountId,
        categoryId,
      });
      await this.recompute(tx, id);
    });
    return this.get(userId, id);
  }

  async removeTransaction(userId: string, id: string, txId: string): Promise<InvestmentDetailDto> {
    await this.findOwned(userId, id);
    const row = await this.prisma.investmentTransaction.findFirst({
      where: { id: txId, investmentId: id, userId },
    });
    if (!row) throw new AppException(ErrorCode.INVESTMENT_TX_NOT_FOUND);
    await this.prisma.$transaction(async (tx) => {
      await tx.investmentTransaction.delete({ where: { id: txId } });
      await deleteCashMovement(tx, row.transactionId);
      await this.recompute(tx, id);
    });
    return this.get(userId, id);
  }

  async search(userId: string, matches: (...values: (string | null)[]) => boolean, limit: number) {
    const rows = await this.prisma.investment.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ currentValue: 'desc' }],
    });
    const total = rows.reduce((a, i) => a.plus(i.currentValue), new Decimal(0));
    return rows
      .filter((r) => matches(r.name, r.ticker))
      .slice(0, limit)
      .map((r) => this.toDto(r, total));
  }

  // ─────────────────────────── Internos ───────────────────────────

  private async insertTx(
    tx: Tx,
    userId: string,
    investment: Investment,
    input: {
      type: InvestmentTransactionType;
      amount: Decimal;
      quantity: Decimal | null;
      price: Decimal | null;
      date: DateOnly;
      note: string | null;
      accountId: string | null;
      description?: string;
      categoryId?: string | null;
    },
  ): Promise<void> {
    let transactionId: string | null = null;
    if (input.accountId && input.type !== 'VALUATION') {
      const kind =
        input.type === 'BUY'
          ? 'OUT'
          : input.type === 'SELL'
            ? 'IN'
            : input.type === 'FEE'
              ? 'EXPENSE'
              : 'INCOME';
      transactionId = await createCashMovement(tx, {
        userId,
        kind,
        accountId: input.accountId,
        amount: input.amount,
        date: input.date,
        description: input.description ?? `${CASH_DESCRIPTION[input.type]}: ${investment.name}`,
        categoryId: input.categoryId ?? null,
      });
    }
    await tx.investmentTransaction.create({
      data: {
        userId,
        investmentId: investment.id,
        type: input.type,
        amount: input.amount,
        quantity: input.quantity,
        price: input.price,
        date: toDbDate(input.date),
        notes: input.note,
        accountId: input.accountId,
        transactionId,
      },
    });
  }

  /** Reexecuta todas as movimentações e grava a posição; posição inválida desfaz a transação. */
  private async recompute(tx: Tx, id: string): Promise<PositionState> {
    const txs = await tx.investmentTransaction.findMany({ where: { investmentId: id } });
    let state: PositionState;
    try {
      state = replay(txs.map(toEngine));
    } catch (error) {
      if (error instanceof InsufficientPositionError)
        throw new AppException(ErrorCode.INVESTMENT_INSUFFICIENT);
      throw error;
    }
    await tx.investment.update({
      where: { id },
      data: {
        quantity: state.quantity,
        averagePrice: state.averagePrice,
        investedAmount: state.investedAmount,
        currentValue: state.currentValue,
        income: state.income,
        realizedGain: state.realizedGain,
        lastValuationAt: state.lastValuationAt ? toDbDate(state.lastValuationAt) : null,
      },
    });
    return state;
  }

  private toDto(row: Investment, portfolioTotal: Decimal): InvestmentDto {
    const state = {
      currentValue: new Decimal(row.currentValue),
      investedAmount: new Decimal(row.investedAmount),
      income: new Decimal(row.income),
      realizedGain: new Decimal(row.realizedGain),
    };
    const { profit, profitPercent } = profitOf(state);
    return {
      id: row.id,
      name: row.name,
      ticker: row.ticker,
      institution: row.institution,
      type: row.type,
      quantity: row.quantity ? qty(new Decimal(row.quantity)) : null,
      averagePrice: row.averagePrice ? qty(new Decimal(row.averagePrice)) : null,
      investedAmount: toMoneyString(state.investedAmount),
      currentValue: toMoneyString(state.currentValue),
      income: toMoneyString(state.income),
      realizedGain: toMoneyString(state.realizedGain),
      profit: toMoneyString(profit),
      profitPercent,
      appliedAt: row.appliedAt ? fromDbDate(row.appliedAt) : null,
      maturityDate: row.maturityDate ? fromDbDate(row.maturityDate) : null,
      liquidity: row.liquidity,
      liquidityDays: row.liquidityDays,
      notes: row.notes,
      allocationPercent: portfolioTotal.greaterThan(0)
        ? pct1(state.currentValue.div(portfolioTotal).times(100))
        : 0,
      lastValuationAt: row.lastValuationAt ? fromDbDate(row.lastValuationAt) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toTxDto(t: TxRow): InvestmentTxDto {
    return {
      id: t.id,
      type: t.type,
      quantity: t.quantity ? qty(new Decimal(t.quantity)) : null,
      price: t.price ? qty(new Decimal(t.price)) : null,
      amount: toMoneyString(t.amount),
      date: fromDbDate(t.date),
      note: t.notes,
      account: t.account,
    };
  }

  private async getDto(userId: string, id: string): Promise<InvestmentDto> {
    const [row, total] = await Promise.all([
      this.findOwned(userId, id),
      this.prisma.investment.aggregate({
        where: { userId, deletedAt: null },
        _sum: { currentValue: true },
      }),
    ]);
    return this.toDto(row, new Decimal(total._sum.currentValue ?? 0));
  }

  private async defaultIncomeCategory(userId: string): Promise<string | null> {
    const category = await this.prisma.category.findFirst({
      where: { userId, deletedAt: null, type: 'INCOME', name: 'Rendimentos', parentId: null },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  private async activeAccount(userId: string, id: string): Promise<string> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
    if (account.status !== 'ACTIVE') throw new AppException(ErrorCode.ACCOUNT_ARCHIVED);
    return account.id;
  }

  private assertNotFuture(date: DateOnly, today: DateOnly, field: string): void {
    if (date > today) this.fail(field, 'A data não pode ser futura');
  }

  private fail(field: string, message: string): never {
    throw new AppException(ErrorCode.VALIDATION_ERROR, { details: [{ field, message }] });
  }

  private async findOwned(userId: string, id: string): Promise<Investment> {
    const row = await this.prisma.investment.findFirst({ where: { id, userId, deletedAt: null } });
    if (!row) throw new AppException(ErrorCode.INVESTMENT_NOT_FOUND);
    return row;
  }

  private async today(userId: string): Promise<DateOnly> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayIn(user?.timezone ?? 'America/Sao_Paulo');
  }
}
