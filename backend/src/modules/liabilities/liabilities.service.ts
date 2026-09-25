import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { fromDbDate, todayIn, toDbDate } from '../../common/utils/date-only.js';
import { Decimal, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { rejectNulls } from '../../common/validation/reject-nulls.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Liability } from '../../generated/prisma/client.js';
import { createCashMovement } from '../transactions/cash-movement.js';
import { liabilityMath } from './liability.calc.js';
import type {
  CreateLiabilityDto,
  LiabilityDetailDto,
  LiabilityDto,
  PayLiabilityDto,
  UpdateLiabilityDto,
} from './liability.dto.js';

function toDto(l: Liability): LiabilityDto {
  const math = liabilityMath(
    new Decimal(l.principal),
    new Decimal(l.outstandingBalance),
    l.monthlyPayment ? new Decimal(l.monthlyPayment) : null,
  );
  return {
    id: l.id,
    name: l.name,
    type: l.type,
    principal: toMoneyString(l.principal),
    outstandingBalance: toMoneyString(l.outstandingBalance),
    interestRate: l.interestRate ? new Decimal(l.interestRate).toFixed(4) : null,
    monthlyPayment: l.monthlyPayment ? toMoneyString(l.monthlyPayment) : null,
    dueDay: l.dueDay,
    startDate: l.startDate ? fromDbDate(l.startDate) : null,
    endDate: l.endDate ? fromDbDate(l.endDate) : null,
    ...math,
    notes: l.notes,
  };
}

@Injectable()
export class LiabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.liability.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ outstandingBalance: 'desc' }, { createdAt: 'asc' }],
    });
    const open = rows.filter((r) => new Decimal(r.outstandingBalance).greaterThan(0));
    return {
      data: rows.map(toDto),
      meta: {
        total: toMoneyString(rows.reduce((a, r) => a.plus(r.outstandingBalance), new Decimal(0))),
        monthlyPayments: toMoneyString(
          open.reduce((a, r) => a.plus(r.monthlyPayment ?? 0), new Decimal(0)),
        ),
        count: rows.length,
      },
    };
  }

  async get(userId: string, id: string): Promise<LiabilityDetailDto> {
    const row = await this.findOwned(userId, id);
    const payments = await this.prisma.liabilityPayment.findMany({
      where: { liabilityId: id },
      include: { account: { select: { id: true, name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return {
      ...toDto(row),
      payments: payments.map((p) => ({
        id: p.id,
        amount: toMoneyString(p.amount),
        date: fromDbDate(p.date),
        account: p.account,
        transactionId: p.transactionId,
      })),
    };
  }

  async create(userId: string, dto: CreateLiabilityDto): Promise<LiabilityDto> {
    const principal = toDecimal(dto.principal);
    const row = await this.prisma.liability.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        principal,
        outstandingBalance: dto.outstandingBalance ? toDecimal(dto.outstandingBalance) : principal,
        interestRate: dto.interestRate ? new Decimal(dto.interestRate) : null,
        monthlyPayment: dto.monthlyPayment ? toDecimal(dto.monthlyPayment) : null,
        dueDay: dto.dueDay ?? null,
        startDate: dto.startDate ? toDbDate(dto.startDate) : null,
        endDate: dto.endDate ? toDbDate(dto.endDate) : null,
        notes: dto.notes ?? null,
      },
    });
    return toDto(row);
  }

  async update(userId: string, id: string, dto: UpdateLiabilityDto): Promise<LiabilityDto> {
    rejectNulls(dto, ['name', 'type', 'principal', 'outstandingBalance']);
    await this.findOwned(userId, id);
    const orNull = <T>(value: T | null | undefined, map: (v: T) => unknown) =>
      value === undefined ? undefined : value === null ? null : map(value);
    const row = await this.prisma.liability.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        principal: dto.principal ? toDecimal(dto.principal) : undefined,
        outstandingBalance: dto.outstandingBalance ? toDecimal(dto.outstandingBalance) : undefined,
        interestRate: orNull(dto.interestRate, (v) => new Decimal(v)) as Decimal | null | undefined,
        monthlyPayment: orNull(dto.monthlyPayment, (v) => toDecimal(v)) as
          Decimal | null | undefined,
        dueDay: dto.dueDay,
        startDate: orNull(dto.startDate, (v) => toDbDate(v)) as Date | null | undefined,
        endDate: orNull(dto.endDate, (v) => toDbDate(v)) as Date | null | undefined,
        notes: dto.notes,
      },
    });
    return toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.liability.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Amortiza o saldo devedor (sem separar juros/principal). Com accountId, debita a conta
   * com uma TRANSFER neutra no fluxo ("Pagamento: <nome>").
   */
  async pay(userId: string, id: string, dto: PayLiabilityDto): Promise<LiabilityDetailDto> {
    const liability = await this.findOwned(userId, id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (dto.date > todayIn(user?.timezone ?? 'America/Sao_Paulo')) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'date', message: 'A data do pagamento não pode ser futura' }],
      });
    }
    const amount = toDecimal(dto.amount);
    if (amount.greaterThan(liability.outstandingBalance)) {
      throw new AppException(ErrorCode.PAYMENT_EXCEEDS_BALANCE);
    }
    let accountId: string | null = null;
    if (dto.accountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, userId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
      if (account.status !== 'ACTIVE') throw new AppException(ErrorCode.ACCOUNT_ARCHIVED);
      accountId = account.id;
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.liability.update({
        where: { id },
        data: { outstandingBalance: { decrement: amount } },
      });
      if (new Decimal(updated.outstandingBalance).lessThan(0))
        throw new AppException(ErrorCode.PAYMENT_EXCEEDS_BALANCE);
      const transactionId = accountId
        ? await createCashMovement(tx, {
            userId,
            kind: 'OUT',
            accountId,
            amount,
            date: dto.date,
            description: `Pagamento: ${liability.name}`,
          })
        : null;
      await tx.liabilityPayment.create({
        data: {
          userId,
          liabilityId: id,
          amount,
          date: toDbDate(dto.date),
          accountId,
          transactionId,
        },
      });
    });
    return this.get(userId, id);
  }

  private async findOwned(userId: string, id: string): Promise<Liability> {
    const row = await this.prisma.liability.findFirst({ where: { id, userId, deletedAt: null } });
    if (!row) throw new AppException(ErrorCode.LIABILITY_NOT_FOUND);
    return row;
  }
}
