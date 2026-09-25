import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  addMonthsYm,
  monthStart,
  todayIn,
  toDbDate,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom } from '../../common/utils/money.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { netWorthParts } from './net-worth-parts.js';

const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WRITE_CHUNK = 100;
const dec = decimalFrom;

/**
 * Snapshot diário do patrimônio por usuário (upsert em (userId, data de hoje no fuso dele)).
 * Leituras agregadas para todos os usuários de uma vez (groupBy), gravações em lotes.
 * Roda a cada 6h (idempotente: reescreve o snapshot do dia); desligado em NODE_ENV=test.
 */
@Injectable()
export class SnapshotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SnapshotService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;
    this.timer = setInterval(() => void this.run(), SNAPSHOT_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 30_000).unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(now: Date = new Date(), onlyUserIds?: string[]): Promise<number> {
    try {
      return await this.snapshot(now, onlyUserIds);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Falha nos snapshots',
      );
      return 0;
    }
  }

  private async snapshot(now: Date, onlyUserIds?: string[]): Promise<number> {
    const userFilter = onlyUserIds ? { in: onlyUserIds } : undefined;
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(userFilter ? { id: userFilter } : {}) },
      select: { id: true, timezone: true },
    });
    if (!users.length) return 0;
    const ids = users.map((u) => u.id);
    // Início do mês anterior (UTC) cobre o "mês atual" em qualquer fuso.
    const since = monthStart(addMonthsYm(yearMonthOf(now.toISOString().slice(0, 10)), -1));

    const [accounts, investments, assets, liabilities, funds, flows, cardDebts] = await Promise.all(
      [
        this.prisma.account.groupBy({
          by: ['userId', 'type'],
          where: {
            userId: { in: ids },
            deletedAt: null,
            status: 'ACTIVE',
            includeInNetWorth: true,
          },
          _sum: { currentBalance: true },
        }),
        this.prisma.investment.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, deletedAt: null },
          _sum: { currentValue: true },
        }),
        this.prisma.asset.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, deletedAt: null },
          _sum: { value: true },
        }),
        this.prisma.liability.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, deletedAt: null },
          _sum: { outstandingBalance: true },
        }),
        this.prisma.emergencyFund.findMany({
          where: { userId: { in: ids } },
          select: {
            userId: true,
            currentAmount: true,
            linkedAccount: { select: { currentBalance: true, deletedAt: true } },
          },
        }),
        this.prisma.$queryRaw<{ user_id: string; month: string; type: string; amount: unknown }[]>`
        SELECT user_id::text AS user_id, to_char(date, 'YYYY-MM') AS month, type::text AS type, SUM(amount) AS amount
        FROM transactions
        WHERE deleted_at IS NULL AND type IN ('INCOME', 'EXPENSE') AND date >= ${since}::date
          AND user_id = ANY(${ids}::uuid[])
        GROUP BY 1, 2, 3`,
        this.prisma.$queryRaw<{ user_id: string; debt: unknown }[]>`
        SELECT c.user_id::text AS user_id, SUM(GREATEST(i.total - i.paid_amount, 0)) AS debt
        FROM credit_card_invoices i
        JOIN credit_cards c ON c.id = i.card_id
        WHERE c.deleted_at IS NULL AND c.user_id = ANY(${ids}::uuid[])
        GROUP BY 1`,
      ],
    );

    const group = <T extends { userId: string }>(rows: T[]) => {
      const map = new Map<string, T[]>();
      for (const row of rows) map.set(row.userId, [...(map.get(row.userId) ?? []), row]);
      return map;
    };
    const accountsByUser = group(accounts);
    const sumBy = <T extends { userId: string }>(rows: T[], pick: (r: T) => unknown) =>
      new Map(rows.map((r) => [r.userId, dec(pick(r))]));
    const investmentsByUser = sumBy(investments, (r) => r._sum.currentValue);
    const assetsByUser = sumBy(assets, (r) => r._sum.value);
    const liabilitiesByUser = sumBy(liabilities, (r) => r._sum.outstandingBalance);
    const fundByUser = new Map(
      funds.map((f) => [
        f.userId,
        f.linkedAccount && !f.linkedAccount.deletedAt
          ? dec(f.linkedAccount.currentBalance)
          : dec(f.currentAmount),
      ]),
    );

    const writes = users.map((user) => {
      const today = todayIn(user.timezone, now);
      const month = yearMonthOf(today);
      const parts = netWorthParts({
        accounts: (accountsByUser.get(user.id) ?? []).map((a) => ({
          type: a.type,
          currentBalance: dec(a._sum.currentBalance),
        })),
        investmentsValue: investmentsByUser.get(user.id) ?? '0',
        assetsValue: assetsByUser.get(user.id) ?? '0',
        liabilities: liabilitiesByUser.get(user.id) ?? '0',
        cardDebt: dec(cardDebts.find((d) => d.user_id === user.id)?.debt),
      });
      const monthFlows = flows.filter((f) => f.user_id === user.id && f.month === month);
      const sumType = (type: string) =>
        monthFlows
          .filter((f) => f.type === type)
          .reduce((acc, f) => acc.plus(dec(f.amount)), new Decimal(0));
      const data = {
        netWorth: parts.netWorth,
        totalAssets: parts.assets,
        totalLiabilities: parts.liabilities,
        cash: parts.cash,
        investments: parts.investments,
        emergencyFund: fundByUser.get(user.id) ?? new Decimal(0),
        income: sumType('INCOME'),
        expenses: sumType('EXPENSE'),
      };
      const date = toDbDate(today);
      return this.prisma.financialSnapshot.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: { userId: user.id, date, ...data },
        update: data,
      });
    });

    for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
      await this.prisma.$transaction(writes.slice(i, i + WRITE_CHUNK));
    }
    this.logger.log({ users: writes.length }, 'Snapshots financeiros atualizados');
    return writes.length;
  }
}
