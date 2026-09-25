import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  addMonthsYm,
  type DateOnly,
  monthEnd,
  monthRange,
  monthStart,
  todayIn,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, decimalFrom, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Account, EmergencyFund } from '../../generated/prisma/client.js';
import type { EmergencyFundDto, PutEmergencyFundDto } from './emergency-fund.dto.js';
import { emergencyMath, emergencySuggestions } from './emergency.calc.js';

type LinkedAccount = Pick<
  Account,
  'id' | 'name' | 'icon' | 'color' | 'currentBalance' | 'deletedAt'
>;
type FundWithAccount = EmergencyFund & { linkedAccount: LinkedAccount | null };

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  icon: true,
  color: true,
  currentBalance: true,
  deletedAt: true,
} as const;

/** Valor atual da reserva: saldo da conta vinculada (se ativa) ou o valor manual. */
export function emergencyCurrent(fund: FundWithAccount): {
  mode: 'LINKED' | 'MANUAL';
  current: Decimal;
} {
  if (fund.linkedAccount && !fund.linkedAccount.deletedAt) {
    return { mode: 'LINKED', current: new Decimal(fund.linkedAccount.currentBalance) };
  }
  return { mode: 'MANUAL', current: new Decimal(fund.currentAmount) };
}

@Injectable()
export class EmergencyFundService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reserva com a conta vinculada (usado também pelo dashboard). */
  findWithAccount(userId: string): Promise<FundWithAccount | null> {
    return this.prisma.emergencyFund.findUnique({
      where: { userId },
      include: { linkedAccount: { select: ACCOUNT_SELECT } },
    });
  }

  async get(userId: string): Promise<EmergencyFundDto | null> {
    const fund = await this.findWithAccount(userId);
    return fund ? this.toDto(userId, fund) : null;
  }

  async put(userId: string, dto: PutEmergencyFundDto): Promise<EmergencyFundDto> {
    const monthlyCost = toDecimal(dto.monthlyCost);
    const customTarget = Boolean(dto.targetAmount);
    const targetAmount = dto.targetAmount
      ? toDecimal(dto.targetAmount)
      : monthlyCost.times(dto.targetMonths);

    let linkedAccountId: string | null = null;
    if (dto.linkedAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.linkedAccountId, userId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
      if (account.status !== 'ACTIVE') throw new AppException(ErrorCode.ACCOUNT_ARCHIVED);
      linkedAccountId = account.id;
    }

    const data = {
      monthlyCost,
      targetMonths: dto.targetMonths,
      targetAmount,
      customTarget,
      linkedAccountId,
      monthlyContribution: dto.monthlyContribution ? toDecimal(dto.monthlyContribution) : null,
      // currentAmount só é usado no modo manual; ao vincular, o valor manual é preservado.
      ...(dto.currentAmount && !linkedAccountId
        ? { currentAmount: toDecimal(dto.currentAmount) }
        : {}),
    };
    await this.prisma.emergencyFund.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return (await this.get(userId)) as EmergencyFundDto;
  }

  async adjust(userId: string, amount: string): Promise<EmergencyFundDto> {
    const fund = await this.findWithAccount(userId);
    if (!fund) throw new AppException(ErrorCode.EMERGENCY_FUND_NOT_FOUND);
    if (emergencyCurrent(fund).mode === 'LINKED')
      throw new AppException(ErrorCode.EMERGENCY_FUND_LINKED);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.emergencyFund.update({
        where: { userId },
        data: { currentAmount: { increment: toDecimal(amount) } },
      });
      if (new Decimal(updated.currentAmount).lessThan(0)) {
        throw new AppException(ErrorCode.VALIDATION_ERROR, {
          details: [{ field: 'amount', message: 'A reserva não pode ficar negativa' }],
        });
      }
    });
    return (await this.get(userId)) as EmergencyFundDto;
  }

  private async toDto(userId: string, fund: FundWithAccount): Promise<EmergencyFundDto> {
    const today = await this.today(userId);
    const { mode, current } = emergencyCurrent(fund);
    const math = emergencyMath({
      today,
      current,
      target: new Decimal(fund.targetAmount),
      monthlyCost: new Decimal(fund.monthlyCost),
      monthlyContribution: fund.monthlyContribution ? new Decimal(fund.monthlyContribution) : null,
    });
    return {
      monthlyCost: toMoneyString(fund.monthlyCost),
      targetMonths: fund.targetMonths,
      targetAmount: toMoneyString(fund.targetAmount),
      customTarget: fund.customTarget,
      mode,
      linkedAccount:
        mode === 'LINKED' && fund.linkedAccount
          ? {
              id: fund.linkedAccount.id,
              name: fund.linkedAccount.name,
              icon: fund.linkedAccount.icon,
              color: fund.linkedAccount.color,
              currentBalance: toMoneyString(fund.linkedAccount.currentBalance),
            }
          : null,
      currentAmount: toMoneyString(current),
      ...math,
      monthlyContribution: fund.monthlyContribution
        ? toMoneyString(fund.monthlyContribution)
        : null,
      suggestions: await this.suggestions(userId, today),
    };
  }

  /** Receita/despesa dos 3 meses completos anteriores (uma consulta agregada). */
  private async suggestions(userId: string, today: DateOnly) {
    const months = monthRange(addMonthsYm(yearMonthOf(today), -1), 3);
    const rows = await this.prisma.$queryRaw<{ month: string; type: string; amount: unknown }[]>`
      SELECT to_char(date, 'YYYY-MM') AS month, type::text AS type, SUM(amount) AS amount
      FROM transactions
      WHERE user_id = ${userId}::uuid AND deleted_at IS NULL AND type IN ('INCOME', 'EXPENSE')
        AND date >= ${monthStart(months[0])}::date AND date <= ${monthEnd(months[2])}::date
      GROUP BY 1, 2`;
    return emergencySuggestions(
      months.map((m) => ({
        income: rows
          .filter((r) => r.month === m && r.type === 'INCOME')
          .reduce((a, r) => a.plus(decimalFrom(r.amount)), new Decimal(0)),
        expense: rows
          .filter((r) => r.month === m && r.type === 'EXPENSE')
          .reduce((a, r) => a.plus(decimalFrom(r.amount)), new Decimal(0)),
      })),
    );
  }

  private async today(userId: string): Promise<DateOnly> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayIn(user?.timezone ?? 'America/Sao_Paulo');
  }
}
