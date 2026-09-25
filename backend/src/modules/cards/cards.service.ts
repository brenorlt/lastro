import { Injectable } from '@nestjs/common';
import { AppException, type ErrorDetail } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  addMonthsYm,
  type DateOnly,
  fromDbDate,
  isValidYearMonth,
  monthRange,
  monthStart,
  todayIn,
  toDbDate,
  type YearMonth,
  yearMonthOf,
} from '../../common/utils/date-only.js';
import { Decimal, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { transactionSearchText } from '../../common/utils/search-text.js';
import { rejectNulls } from '../../common/validation/reject-nulls.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreditCard, CreditCardInvoice } from '../../generated/prisma/client.js';
import { balanceDelta } from '../transactions/balance.js';
import { applyBalanceDelta } from '../transactions/balance-writer.js';
import { TRANSACTION_INCLUDE, toTransactionDto } from '../transactions/transaction.mapper.js';
import type {
  CardDto,
  CardsMetaDto,
  CreateCardDto,
  InvoiceDetailDto,
  InvoiceSummaryDto,
  PayInvoiceDto,
  PaymentResultDto,
  SpendingPointDto,
  UpdateCardDto,
} from './card.dto.js';
import { invoiceDates, invoiceFor, invoiceStatus, limitUsage, monthLabel } from './invoice.calc.js';
import { applyInvoiceDelta, invoiceDelta } from './invoice-writer.js';

type CardWithAccount = CreditCard & {
  paymentAccount: { id: string; name: string; color: string | null; icon: string | null } | null;
};

const CARD_INCLUDE = {
  paymentAccount: { select: { id: true, name: true, color: true, icon: true } },
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

const refOf = (invoice: CreditCardInvoice): YearMonth =>
  yearMonthOf(fromDbDate(invoice.referenceMonth));

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── Cartões ───────────────────────────

  async list(
    userId: string,
    status: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE',
  ): Promise<{ data: CardDto[]; meta: CardsMetaDto }> {
    const today = await this.today(userId);
    const cards = await this.prisma.creditCard.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(status === 'ALL'
          ? {}
          : status === 'ACTIVE'
            ? { status: { in: ['ACTIVE', 'BLOCKED'] } }
            : { status }),
      },
      include: CARD_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    const invoices = await this.prisma.creditCardInvoice.findMany({
      where: { cardId: { in: cards.map((c) => c.id) } },
    });
    const data = await Promise.all(
      cards.map((card) =>
        this.toDto(
          card,
          invoices.filter((i) => i.cardId === card.id),
          today,
        ),
      ),
    );

    const sum = (pick: (c: CardDto) => string) =>
      toMoneyString(data.reduce((acc, c) => acc.plus(pick(c)), new Decimal(0)));
    const nextDue = data
      .filter((c) => c.nextDueInvoice)
      .map((c) => ({ cardId: c.id, invoice: c.nextDueInvoice as InvoiceSummaryDto }))
      .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate))[0];
    return {
      data,
      meta: {
        totalLimit: sum((c) => c.limit),
        totalUsed: sum((c) => c.limitUsed),
        totalAvailable: sum((c) => c.availableLimit),
        nextDue: nextDue
          ? {
              cardId: nextDue.cardId,
              referenceMonth: nextDue.invoice.referenceMonth,
              dueDate: nextDue.invoice.dueDate,
              remaining: nextDue.invoice.remaining,
            }
          : null,
      },
    };
  }

  async get(userId: string, id: string): Promise<CardDto> {
    const card = await this.findOwned(userId, id);
    const invoices = await this.prisma.creditCardInvoice.findMany({ where: { cardId: id } });
    return this.toDto(card, invoices, await this.today(userId));
  }

  async create(userId: string, dto: CreateCardDto): Promise<CardDto> {
    await this.assertNameAvailable(userId, dto.name);
    if (dto.paymentAccountId) await this.assertAccount(userId, dto.paymentAccountId);
    try {
      const card = await this.prisma.creditCard.create({
        data: {
          userId,
          name: dto.name,
          institution: dto.institution || null,
          brand: dto.brand,
          limit: toDecimal(dto.limit),
          closingDay: dto.closingDay,
          dueDay: dto.dueDay,
          color: dto.color,
          lastFourDigits: dto.lastFourDigits || null,
          paymentAccountId: dto.paymentAccountId || null,
        },
      });
      return this.get(userId, card.id);
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.CARD_NAME_TAKEN) : error;
    }
  }

  /**
   * Mudar closingDay/dueDay vale só para compras futuras: lançamentos existentes
   * permanecem nas faturas em que já estão.
   */
  async update(userId: string, id: string, dto: UpdateCardDto): Promise<CardDto> {
    rejectNulls(dto, ['name', 'brand', 'limit', 'closingDay', 'dueDay', 'color']);
    const card = await this.findOwned(userId, id);
    if (dto.name !== undefined && card.status === 'ACTIVE')
      await this.assertNameAvailable(userId, dto.name, id);
    if (dto.paymentAccountId) await this.assertAccount(userId, dto.paymentAccountId);
    try {
      await this.prisma.creditCard.update({
        where: { id },
        data: {
          name: dto.name,
          institution: dto.institution === undefined ? undefined : dto.institution || null,
          brand: dto.brand,
          limit: dto.limit ? toDecimal(dto.limit) : undefined,
          closingDay: dto.closingDay,
          dueDay: dto.dueDay,
          color: dto.color,
          lastFourDigits: dto.lastFourDigits === undefined ? undefined : dto.lastFourDigits || null,
          paymentAccountId:
            dto.paymentAccountId === undefined ? undefined : dto.paymentAccountId || null,
        },
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.CARD_NAME_TAKEN) : error;
    }
    return this.get(userId, id);
  }

  async setArchived(userId: string, id: string, archived: boolean): Promise<CardDto> {
    const card = await this.findOwned(userId, id);
    if (!archived && card.status !== 'ACTIVE')
      await this.assertNameAvailable(userId, card.name, id);
    try {
      await this.prisma.creditCard.update({
        where: { id },
        data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.CARD_NAME_TAKEN) : error;
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    const [transactions, recurring] = await Promise.all([
      this.prisma.transaction.count({ where: { userId, deletedAt: null, creditCardId: id } }),
      this.prisma.recurringTransaction.count({
        where: { userId, deletedAt: null, active: true, creditCardId: id },
      }),
    ]);
    const details: ErrorDetail[] = [];
    if (transactions)
      details.push({ field: 'transactions', message: `${transactions} lançamento(s) no cartão` });
    if (recurring)
      details.push({
        field: 'recurringTransactions',
        message: `${recurring} recorrência(s) ativa(s)`,
      });
    if (details.length) throw new AppException(ErrorCode.CARD_IN_USE, { details });
    await this.prisma.creditCard.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ─────────────────────────── Faturas ───────────────────────────

  /** Faturas do intervalo (padrão: 6 anteriores + atual + 3 próximas), incluindo meses virtuais. */
  async invoices(
    userId: string,
    cardId: string,
    from?: YearMonth,
    to?: YearMonth,
  ): Promise<InvoiceSummaryDto[]> {
    const card = await this.findOwned(userId, cardId);
    const today = await this.today(userId);
    const current = invoiceFor(card, today);
    const start = from ?? addMonthsYm(current, -6);
    const end = to ?? addMonthsYm(current, 3);
    if (start > end) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'from', message: 'from deve ser anterior ou igual a to' }],
      });
    }
    const months = this.monthsBetween(start, end);
    const persisted = await this.prisma.creditCardInvoice.findMany({
      where: {
        cardId,
        referenceMonth: { gte: toDbDate(monthStart(start)), lte: toDbDate(monthStart(end)) },
      },
    });
    const byRef = new Map(persisted.map((i) => [refOf(i), i]));
    const summaries = months.map((ref) => this.summary(card, ref, byRef.get(ref) ?? null, today));
    await this.persistStatuses(persisted, summaries);
    return summaries;
  }

  async invoiceDetail(userId: string, cardId: string, ref: string): Promise<InvoiceDetailDto> {
    this.assertRef(ref);
    const card = await this.findOwned(userId, cardId);
    const today = await this.today(userId);
    const invoice = await this.findInvoice(cardId, ref);
    const summary = this.summary(card, ref, invoice, today);
    if (invoice) await this.persistStatuses([invoice], [summary]);
    if (!invoice) return { ...summary, transactions: [], payments: [], byCategory: [] };

    const rows = await this.prisma.transaction.findMany({
      where: { userId, invoiceId: invoice.id, deletedAt: null },
      include: TRANSACTION_INCLUDE,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const purchases = rows.filter((r) => r.type === 'EXPENSE');
    const byCategory = new Map<
      string,
      {
        categoryId: string | null;
        name: string;
        color: string | null;
        icon: string | null;
        amount: Decimal;
      }
    >();
    for (const row of purchases) {
      const key = row.category?.id ?? 'none';
      const entry = byCategory.get(key) ?? {
        categoryId: row.category?.id ?? null,
        name: row.category?.name ?? 'Sem categoria',
        color: row.category?.color ?? '#CBD5E1',
        icon: row.category?.icon ?? 'circle-dashed',
        amount: new Decimal(0),
      };
      entry.amount = entry.amount.plus(row.amount);
      byCategory.set(key, entry);
    }
    return {
      ...summary,
      transactions: purchases.map(toTransactionDto),
      payments: rows.filter((r) => r.type === 'TRANSFER').map(toTransactionDto),
      byCategory: [...byCategory.values()]
        .sort((a, b) => b.amount.comparedTo(a.amount))
        .map((c) => ({ ...c, amount: toMoneyString(c.amount) })),
    };
  }

  /**
   * Pagamento: uma TRANSFER da conta pagadora vinculada à fatura (CLEARED). Debita a conta
   * e soma em paidAmount; excluir o lançamento desfaz ambos.
   */
  async pay(
    userId: string,
    cardId: string,
    ref: string,
    dto: PayInvoiceDto,
  ): Promise<PaymentResultDto> {
    this.assertRef(ref);
    const card = await this.findOwned(userId, cardId);
    const today = await this.today(userId);
    const invoice = await this.findInvoice(cardId, ref);
    if (!invoice) throw new AppException(ErrorCode.INVOICE_NOT_FOUND);

    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
    if (account.status !== 'ACTIVE') throw new AppException(ErrorCode.ACCOUNT_ARCHIVED);

    const date = dto.date ?? today;
    if (date > today) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'date', message: 'A data do pagamento não pode ser futura' }],
      });
    }
    const remaining = new Decimal(invoice.total).minus(invoice.paidAmount);
    const amount = dto.amount ? toDecimal(dto.amount) : remaining;
    if (amount.lessThanOrEqualTo(0) || amount.greaterThan(remaining)) {
      throw new AppException(ErrorCode.PAYMENT_EXCEEDS_INVOICE, {
        details: [
          { field: 'amount', message: `Em aberto: ${toMoneyString(Decimal.max(remaining, 0))}` },
        ],
      });
    }

    const description = `Pagamento fatura ${card.name} ${monthLabel(ref)}`;
    const paymentId = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transaction.create({
        data: {
          userId,
          type: 'TRANSFER',
          amount,
          description,
          searchText: transactionSearchText(description, null),
          date: toDbDate(date),
          status: 'CLEARED',
          accountId: account.id,
          creditCardId: card.id,
          invoiceId: invoice.id,
        },
      });
      await applyBalanceDelta(tx, balanceDelta(null, row));
      await applyInvoiceDelta(tx, invoiceDelta([null, row]));
      const updated = await tx.creditCardInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
      // Concorrência: dois pagamentos simultâneos não podem ultrapassar o total.
      if (new Decimal(updated.paidAmount).greaterThan(updated.total)) {
        throw new AppException(ErrorCode.PAYMENT_EXCEEDS_INVOICE);
      }
      if (new Decimal(updated.paidAmount).greaterThanOrEqualTo(updated.total)) {
        await tx.creditCardInvoice.update({
          where: { id: invoice.id },
          data: { paidAt: new Date() },
        });
      }
      return row.id;
    });

    const fresh = await this.findInvoice(cardId, ref);
    const summary = this.summary(card, ref, fresh, today);
    if (fresh) await this.persistStatuses([fresh], [summary]);
    const payment = await this.prisma.transaction.findUniqueOrThrow({
      where: { id: paymentId },
      include: TRANSACTION_INCLUDE,
    });
    return { invoice: summary, payment: toTransactionDto(payment) };
  }

  async spending(userId: string, cardId: string, months = 6): Promise<SpendingPointDto[]> {
    const card = await this.findOwned(userId, cardId);
    const current = invoiceFor(card, await this.today(userId));
    const refs = monthRange(current, months);
    const invoices = await this.prisma.creditCardInvoice.findMany({
      where: {
        cardId,
        referenceMonth: { gte: toDbDate(monthStart(refs[0])), lte: toDbDate(monthStart(current)) },
      },
      select: { referenceMonth: true, total: true },
    });
    const totals = new Map(
      invoices.map((i) => [yearMonthOf(fromDbDate(i.referenceMonth)), i.total]),
    );
    return refs.map((ref) => ({ referenceMonth: ref, total: toMoneyString(totals.get(ref) ?? 0) }));
  }

  // ─────────────────────────── Internos ───────────────────────────

  private async toDto(
    card: CardWithAccount,
    invoices: CreditCardInvoice[],
    today: DateOnly,
  ): Promise<CardDto> {
    const usage = limitUsage(
      new Decimal(card.limit),
      invoices.map((i) => ({ total: new Decimal(i.total), paidAmount: new Decimal(i.paidAmount) })),
    );
    const currentRef = invoiceFor(card, today);
    const byRef = new Map(invoices.map((i) => [refOf(i), i]));
    const summaries = invoices.map((i) => this.summary(card, refOf(i), i, today));
    await this.persistStatuses(invoices, summaries);
    const nextDue = summaries
      .filter((s) => new Decimal(s.remaining).greaterThan(0))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return {
      id: card.id,
      name: card.name,
      institution: card.institution,
      brand: card.brand,
      color: card.color,
      lastFourDigits: card.lastFourDigits,
      limit: toMoneyString(card.limit),
      limitUsed: toMoneyString(usage.limitUsed),
      availableLimit: toMoneyString(usage.availableLimit),
      usagePercent: usage.usagePercent,
      overLimit: usage.overLimit,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      bestPurchaseDay: card.closingDay,
      status: card.status,
      paymentAccount: card.paymentAccount,
      currentInvoice: this.summary(card, currentRef, byRef.get(currentRef) ?? null, today),
      nextDueInvoice: nextDue ?? null,
      createdAt: card.createdAt.toISOString(),
    };
  }

  /** Resumo de uma fatura persistida ou virtual (sem lançamentos). */
  summary(
    card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
    ref: YearMonth,
    invoice: CreditCardInvoice | null,
    today: DateOnly,
  ): InvoiceSummaryDto {
    const dates = invoice
      ? { closingDate: fromDbDate(invoice.closingDate), dueDate: fromDbDate(invoice.dueDate) }
      : invoiceDates(card, ref);
    const total = new Decimal(invoice?.total ?? 0);
    const paidAmount = new Decimal(invoice?.paidAmount ?? 0);
    return {
      id: invoice?.id ?? null,
      referenceMonth: ref,
      ...dates,
      status: invoiceStatus({ ...dates, total, paidAmount }, today),
      total: toMoneyString(total),
      paidAmount: toMoneyString(paidAmount),
      remaining: toMoneyString(Decimal.max(total.minus(paidAmount), 0)),
    };
  }

  /** Persiste o status calculado quando mudou (leitura mantém a coluna em dia). */
  private async persistStatuses(invoices: CreditCardInvoice[], summaries: InvoiceSummaryDto[]) {
    const byId = new Map(invoices.map((i) => [i.id, i.status]));
    for (const s of summaries) {
      if (s.id && byId.has(s.id) && byId.get(s.id) !== s.status) {
        await this.prisma.creditCardInvoice.update({
          where: { id: s.id },
          data: { status: s.status as CreditCardInvoice['status'] },
        });
      }
    }
  }

  private monthsBetween(start: YearMonth, end: YearMonth): YearMonth[] {
    const months: YearMonth[] = [];
    for (let m = start; m <= end && months.length < 60; m = addMonthsYm(m, 1)) months.push(m);
    return months;
  }

  private assertRef(ref: string): void {
    if (!isValidYearMonth(ref)) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ field: 'ref', message: 'Mês de referência inválido: use AAAA-MM' }],
      });
    }
  }

  private findInvoice(cardId: string, ref: YearMonth) {
    return this.prisma.creditCardInvoice.findUnique({
      where: { cardId_referenceMonth: { cardId, referenceMonth: toDbDate(monthStart(ref)) } },
    });
  }

  private async findOwned(userId: string, id: string): Promise<CardWithAccount> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, userId, deletedAt: null },
      include: CARD_INCLUDE,
    });
    if (!card) throw new AppException(ErrorCode.CARD_NOT_FOUND);
    return card;
  }

  private async assertAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
  }

  /** citext: igualdade case-insensitive entre cartões ativos. */
  private async assertNameAvailable(
    userId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.prisma.creditCard.findFirst({
      where: {
        userId,
        name,
        status: 'ACTIVE',
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new AppException(ErrorCode.CARD_NAME_TAKEN);
  }

  private async today(userId: string): Promise<DateOnly> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayIn(user?.timezone ?? 'America/Sao_Paulo');
  }
}
