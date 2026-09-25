import { Injectable } from '@nestjs/common';
import {
  addMonthsYm,
  fromDbDate,
  monthEnd,
  monthRange,
  monthStart,
  todayIn,
  toDbDate,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  indexFlows,
  type MonthlyFlowRow,
  reconstructNetWorth,
} from '../dashboard/dashboard.calc.js';
import { groupNetWorth } from './net-worth.calc.js';
import { loadNetWorthInput } from './net-worth.loader.js';

@Injectable()
export class NetWorthService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, months = 12) {
    const grouped = groupNetWorth(await loadNetWorthInput(this.prisma, userId));
    const history = await this.history(
      userId,
      grouped.parts.netWorth,
      grouped.parts.liabilities,
      months,
    );
    const { netWorth, assets, liabilities, debtRatio } = grouped;
    const last = history.points[history.points.length - 1];
    const change = last.netWorth.minus(history.base);
    return {
      netWorth,
      assets,
      liabilities,
      debtRatio,
      series: history.points.map((p) => ({
        month: p.month,
        assets: toMoneyString(p.assets),
        liabilities: toMoneyString(p.liabilities),
        netWorth: toMoneyString(p.netWorth),
      })),
      seriesMethod: history.usedSnapshots ? 'snapshots' : 'reconstructed',
      change12m: {
        amount: toMoneyString(change),
        percent: history.base.greaterThan(0)
          ? Number(
              change
                .div(history.base)
                .times(100)
                .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
                .toFixed(1),
            )
          : null,
      },
    };
  }

  /**
   * Série de 12 meses: snapshots de fim de mês quando existem; senão reconstrução pelo fluxo
   * CLEARED (mesmo algoritmo do dashboard). Na reconstrução, o passivo é mantido no valor atual
   * (não há histórico) e ativos = patrimônio + passivo.
   */
  async history(userId: string, currentNetWorth: Decimal, currentLiabilities: Decimal, count = 12) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const month = yearMonthOf(todayIn(user.timezone));
    const months = monthRange(month, count);
    const base = addMonthsYm(month, -12);
    const [rows, snapshots] = await Promise.all([
      this.prisma.$queryRaw<
        {
          month: string;
          type: 'INCOME' | 'EXPENSE';
          status: MonthlyFlowRow['status'];
          amount: unknown;
        }[]
      >`
        SELECT to_char(date, 'YYYY-MM') AS month, type::text AS type, status::text AS status, SUM(amount) AS amount
        FROM transactions
        WHERE user_id = ${userId}::uuid AND deleted_at IS NULL AND type IN ('INCOME', 'EXPENSE')
          AND date >= ${monthStart([months[0], addMonthsYm(month, -11)].sort()[0])}::date
        GROUP BY 1, 2, 3`,
      this.prisma.financialSnapshot.findMany({
        where: {
          userId,
          date: {
            in: [base, ...months].filter((m) => m < month).map((m) => toDbDate(monthEnd(m))),
          },
        },
      }),
    ]);
    const flows = indexFlows(rows.map((r) => ({ ...r, amount: decimalFrom(r.amount) })));
    const snapshotByMonth = new Map(snapshots.map((s) => [yearMonthOf(fromDbDate(s.date)), s]));
    const reconstructed = reconstructNetWorth(
      currentNetWorth,
      [base, ...months],
      flows,
      new Map([...snapshotByMonth].map(([m, s]) => [m, new Decimal(s.netWorth)])),
    );
    const [basePoint, ...points] = reconstructed.points;
    return {
      base: basePoint.value,
      usedSnapshots: reconstructed.usedSnapshots,
      points: points.map((p) => {
        const snapshot = snapshotByMonth.get(p.month);
        const liabilities = snapshot ? new Decimal(snapshot.totalLiabilities) : currentLiabilities;
        return {
          month: p.month,
          netWorth: p.value,
          liabilities,
          assets: snapshot ? new Decimal(snapshot.totalAssets) : p.value.plus(liabilities),
        };
      }),
    };
  }
}
