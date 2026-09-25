import { Injectable } from '@nestjs/common';
import { AppException, type ErrorDetail } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { addMoney, subtractMoney, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { rejectNulls } from '../../common/validation/reject-nulls.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Account, Prisma } from '../../generated/prisma/client.js';
import { fromDbDate } from '../../common/utils/date-only.js';
import type {
  AccountDetailDto,
  AccountDto,
  AccountsMetaDto,
  CreateAccountDto,
  ListAccountsQueryDto,
  UpdateAccountDto,
} from './dto/account.dto.js';

export function toAccountDto(account: Account): AccountDto {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    type: account.type,
    initialBalance: toMoneyString(account.initialBalance),
    currentBalance: toMoneyString(account.currentBalance),
    color: account.color,
    icon: account.icon,
    status: account.status,
    includeInNetWorth: account.includeInNetWorth,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: ListAccountsQueryDto,
  ): Promise<{ data: AccountDto[]; meta: AccountsMetaDto }> {
    const status = query.status ?? 'ACTIVE';
    const [accounts, totals] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId, deletedAt: null, ...(status === 'ALL' ? {} : { status }) },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.account.groupBy({
        by: ['type'],
        where: { userId, deletedAt: null, status: 'ACTIVE', includeInNetWorth: true },
        _sum: { currentBalance: true },
      }),
    ]);

    const byType: Record<string, string> = {};
    for (const row of totals) byType[row.type] = toMoneyString(row._sum.currentBalance ?? 0);
    const totalBalance = toMoneyString(
      addMoney(...totals.map((row) => row._sum.currentBalance ?? 0)),
    );

    return {
      data: accounts.map(toAccountDto),
      meta: { totalBalance, count: accounts.length, byType },
    };
  }

  async get(userId: string, id: string): Promise<AccountDetailDto> {
    const account = await this.findOwned(userId, id);
    const stats = await this.prisma.transaction.aggregate({
      where: { userId, deletedAt: null, OR: [{ accountId: id }, { transferAccountId: id }] },
      _count: { _all: true },
      _max: { date: true },
    });
    return {
      ...toAccountDto(account),
      stats: {
        transactionCount: stats._count._all,
        lastTransactionDate: stats._max.date ? fromDbDate(stats._max.date) : null,
      },
    };
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    await this.assertNameAvailable(userId, dto.name);
    const initial = toDecimal(dto.initialBalance);
    try {
      const account = await this.prisma.account.create({
        data: {
          userId,
          name: dto.name,
          institution: dto.institution || null,
          type: dto.type,
          initialBalance: initial,
          currentBalance: initial,
          color: dto.color,
          icon: dto.icon,
          includeInNetWorth: dto.includeInNetWorth ?? true,
        },
      });
      return toAccountDto(account);
    } catch (error) {
      throw this.mapUnique(error);
    }
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountDto> {
    rejectNulls(dto, ['name', 'type', 'initialBalance', 'color', 'icon', 'includeInNetWorth']);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const current = await this.findOwned(userId, id, tx);
        if (dto.name !== undefined && current.status === 'ACTIVE') {
          await this.assertNameAvailable(userId, dto.name, id, tx);
        }

        const data: Prisma.AccountUpdateInput = {
          name: dto.name,
          type: dto.type,
          color: dto.color,
          icon: dto.icon,
          includeInNetWorth: dto.includeInNetWorth,
        };
        if (dto.institution !== undefined) data.institution = dto.institution || null;
        if (dto.initialBalance !== undefined) {
          // Mantém o efeito dos lançamentos: currentBalance desloca pela mesma diferença.
          const delta = subtractMoney(dto.initialBalance, current.initialBalance);
          data.initialBalance = toDecimal(dto.initialBalance);
          data.currentBalance = { increment: delta };
        }
        return tx.account.update({ where: { id }, data });
      });
      return toAccountDto(account);
    } catch (error) {
      throw this.mapUnique(error);
    }
  }

  async setArchived(userId: string, id: string, archived: boolean): Promise<AccountDto> {
    const current = await this.findOwned(userId, id);
    if (!archived && current.status === 'ARCHIVED') {
      await this.assertNameAvailable(userId, current.name, id);
    }
    try {
      const account = await this.prisma.account.update({
        where: { id },
        data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
      });
      return toAccountDto(account);
    } catch (error) {
      throw this.mapUnique(error);
    }
  }

  /** Soft delete; bloqueado (409 ACCOUNT_IN_USE) se houver qualquer vínculo. */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    const [transactions, recurring, cards, contributions, funds, investments] = await Promise.all([
      this.prisma.transaction.count({
        where: { userId, deletedAt: null, OR: [{ accountId: id }, { transferAccountId: id }] },
      }),
      this.prisma.recurringTransaction.count({
        where: { userId, deletedAt: null, OR: [{ accountId: id }, { transferAccountId: id }] },
      }),
      this.prisma.creditCard.count({ where: { userId, deletedAt: null, paymentAccountId: id } }),
      this.prisma.goalContribution.count({ where: { userId, accountId: id } }),
      this.prisma.emergencyFund.count({ where: { userId, linkedAccountId: id } }),
      this.prisma.investment.count({ where: { userId, deletedAt: null, accountId: id } }),
    ]);

    const details: ErrorDetail[] = [];
    const add = (field: string, count: number, singular: string, plural: string) => {
      if (count > 0)
        details.push({ field, message: `${count} ${count === 1 ? singular : plural}` });
    };
    add('transactions', transactions, 'lançamento vinculado', 'lançamentos vinculados');
    add('recurringTransactions', recurring, 'recorrência vinculada', 'recorrências vinculadas');
    add('creditCards', cards, 'cartão paga por esta conta', 'cartões pagam por esta conta');
    add('goalContributions', contributions, 'aporte em meta', 'aportes em metas');
    add('emergencyFund', funds, 'reserva de emergência vinculada', 'reservas vinculadas');
    add('investments', investments, 'investimento vinculado', 'investimentos vinculados');
    if (details.length) throw new AppException(ErrorCode.ACCOUNT_IN_USE, { details });

    await this.prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findOwned(
    userId: string,
    id: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Account> {
    const account = await db.account.findFirst({ where: { id, userId, deletedAt: null } });
    if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
    return account;
  }

  /** `name` é citext: a igualdade no banco já é case-insensitive. */
  private async assertNameAvailable(
    userId: string,
    name: string,
    exceptId?: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const clash = await db.account.findFirst({
      where: {
        userId,
        name,
        status: 'ACTIVE',
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new AppException(ErrorCode.ACCOUNT_NAME_TAKEN);
  }

  private mapUnique(error: unknown): unknown {
    return isUniqueViolation(error) ? new AppException(ErrorCode.ACCOUNT_NAME_TAKEN) : error;
  }
}
