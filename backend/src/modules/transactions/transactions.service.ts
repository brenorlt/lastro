import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import {
  addDays,
  type DateOnly,
  fromDbDate,
  todayIn,
  toDbDate,
} from '../../common/utils/date-only.js';
import { formatMoney, splitInstallments, toDecimal } from '../../common/utils/money.js';
import { normalizeSearch, transactionSearchText } from '../../common/utils/search-text.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CategoryType } from '../../generated/prisma/enums.js';
import { BudgetsService } from '../budgets/budgets.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { type CardCycle, invoiceFor } from '../cards/invoice.calc.js';
import { applyInvoiceDelta, ensureInvoice, invoiceDelta } from '../cards/invoice-writer.js';
import { TagsService } from '../tags/tags.service.js';
import { balanceDelta, mergeDeltas } from './balance.js';
import { applyBalanceDelta } from './balance-writer.js';
import type {
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  Scope,
  TransactionDto,
  TransactionListMetaDto,
  UpdateTransactionDto,
} from './dto/transaction.dto.js';
import {
  MAX_OCCURRENCES_PER_RUN,
  RecurrenceService,
  RECURRENCE_HORIZON_DAYS,
} from './recurrence.service.js';
import { installmentDates, recurrenceDates } from './schedule.js';
import { computeTotals } from './totals.js';
import {
  TRANSACTION_INCLUDE,
  toTransactionDto,
  type TransactionWithRelations,
} from './transaction.mapper.js';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;
type ApiStatus = 'CLEARED' | 'PENDING';
export type CardRef = CardCycle & { id: string; userId: string };

/** Linha de extrato revisada pelo usuário, pronta para virar lançamento. */
export interface ImportRowInput {
  externalId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string;
  date: DateOnly;
  categoryId?: string | null;
}

const FUTURE_CLEARED_MESSAGE = 'Lançamentos futuros ficam como pendentes';

function validation(field: string, message: string): AppException {
  return new AppException(ErrorCode.VALIDATION_ERROR, { details: [{ field, message }] });
}

/** Regra de status: padrão CLEARED se data ≤ hoje, senão PENDING; CLEARED no futuro é inválido. */
export function resolveStatus(
  requested: ApiStatus | undefined,
  date: DateOnly,
  today: DateOnly,
): ApiStatus {
  if (requested === 'CLEARED' && date > today) throw validation('status', FUTURE_CLEARED_MESSAGE);
  return requested ?? (date <= today ? 'CLEARED' : 'PENDING');
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: TagsService,
    private readonly recurrence: RecurrenceService,
    private readonly budgets: BudgetsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Aviso opcional de novo lançamento (pref newTransactions, desligada por padrão). */
  private async notifyNew(userId: string, first: TransactionDto | undefined, count: number) {
    if (!first) return;
    await this.notifications.notify(
      userId,
      {
        type: 'NEW_TRANSACTION',
        title:
          count > 1
            ? `${count} lançamentos criados: ${first.description}`
            : `Novo lançamento: ${first.description}`,
        body: `${first.description} · ${formatMoney(first.amount)}`,
        data: { transactionId: first.id, href: '/lancamentos' },
      },
      { topic: 'newTransactions', dedupeKey: `tx:${first.id}` },
    );
  }

  /** Após gravar despesas, reavalia os orçamentos dos meses afetados (após o commit). */
  private async withBudgetAlerts(
    userId: string,
    result: TransactionDto[],
    before: { type: string; date: Date }[] = [],
  ): Promise<TransactionDto[]> {
    const months = [
      ...result.filter((t) => t.type === 'EXPENSE').map((t) => t.date.slice(0, 7)),
      ...before.filter((t) => t.type === 'EXPENSE').map((t) => fromDbDate(t.date).slice(0, 7)),
    ];
    if (months.length) await this.budgets.evaluateAlerts(userId, months);
    return result;
  }

  // ─────────────────────────── Leitura ───────────────────────────

  async list(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<{ data: TransactionDto[]; meta: TransactionListMetaDto }> {
    const where = await this.buildWhere(userId, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const order = query.order ?? 'desc';
    const sortField = query.sort ?? 'date';
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] = [
      { [sortField]: order },
      ...(sortField === 'date' ? [] : [{ date: 'desc' as const }]),
      { createdAt: 'desc' },
      { id: 'desc' },
    ];

    const [rows, grouped] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.groupBy({
        by: ['type', 'status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const { total, totals } = computeTotals(
      grouped.map((g) => ({
        type: g.type,
        status: g.status,
        count: g._count._all,
        sum: g._sum.amount,
      })),
    );
    return {
      data: rows.map(toTransactionDto),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), totals },
    };
  }

  async get(userId: string, id: string): Promise<TransactionDto> {
    return toTransactionDto(await this.findOwned(userId, id));
  }

  /** Busca rápida para o /search global. */
  async search(userId: string, q: string, limit: number): Promise<TransactionDto[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { userId, deletedAt: null, searchText: { contains: normalizeSearch(q) } },
      include: TRANSACTION_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return rows.map(toTransactionDto);
  }

  // ─────────────────────────── Criação ───────────────────────────

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto[]> {
    const today = await this.userToday(userId);
    const { accountId, card } = await this.resolveSource(
      userId,
      dto.type,
      dto.accountId,
      dto.creditCardId,
    );
    const categoryId = dto.categoryId
      ? await this.resolveCategory(userId, dto.categoryId, dto.type)
      : null;

    const base = {
      userId,
      type: dto.type,
      description: dto.description,
      notes: dto.notes ?? null,
      searchText: transactionSearchText(dto.description, dto.notes),
      accountId,
      creditCardId: card?.id ?? null,
      card,
      categoryId,
    };

    const ids = await this.prisma.$transaction(async (tx) => {
      const tagIds = await this.tags.resolveIds(tx, userId, dto.tags ?? []);
      const repeat = dto.repeat;

      if (repeat?.kind === 'INSTALLMENTS') {
        const count = repeat.count ?? 2;
        const firstStatus = resolveStatus(dto.status, dto.date, today);
        const amounts = splitInstallments(dto.amount, count);
        const groupId = randomUUID();
        const created: string[] = [];
        for (const [i, date] of installmentDates(dto.date, count).entries()) {
          const status: ApiStatus =
            i === 0 ? firstStatus : date > today ? 'PENDING' : (dto.status ?? 'CLEARED');
          created.push(
            await this.insertRow(tx, {
              ...base,
              amount: amounts[i],
              date,
              status,
              installmentGroupId: groupId,
              installmentNumber: i + 1,
              installmentTotal: count,
              tagIds,
            }),
          );
        }
        return created;
      }

      if (repeat?.kind === 'RECURRING') {
        const endDate = repeat.endDate ?? null;
        if (endDate && endDate < dto.date) {
          throw validation('repeat.endDate', 'A data final deve ser posterior à inicial');
        }
        const frequency = repeat.frequency ?? 'MONTHLY';
        const interval = repeat.interval ?? 1;
        const preview = recurrenceDates({
          start: dto.date,
          frequency,
          interval,
          endDate,
          until: addDays(today, RECURRENCE_HORIZON_DAYS),
          limit: MAX_OCCURRENCES_PER_RUN,
        });
        if (preview.length >= MAX_OCCURRENCES_PER_RUN) {
          throw validation('date', 'Série muito longa: escolha uma data inicial mais recente');
        }
        const template = await tx.recurringTransaction.create({
          data: {
            userId,
            type: dto.type,
            amount: toDecimal(dto.amount),
            description: dto.description,
            notes: dto.notes ?? null,
            accountId,
            creditCardId: card?.id ?? null,
            categoryId,
            frequency,
            interval,
            startDate: toDbDate(dto.date),
            endDate: endDate ? toDbDate(endDate) : null,
            autoConfirm: repeat.autoConfirm ?? false,
            nextRunAt: toDbDate(dto.date),
          },
        });
        return this.recurrence.materialize(tx, template, today, {
          firstStatus: resolveStatus(dto.status, dto.date, today),
          tagIds,
        });
      }

      return [
        await this.insertRow(tx, {
          ...base,
          amount: toDecimal(dto.amount),
          date: dto.date,
          status: resolveStatus(dto.status, dto.date, today),
          tagIds,
        }),
      ];
    });

    const created = await this.withBudgetAlerts(userId, await this.fetchMany(ids));
    await this.notifyNew(userId, created[0], created.length);
    return created;
  }

  /**
   * Grava linhas de extrato já revisadas numa única transação, com as mesmas regras de saldo e
   * fatura do lançamento manual. Linhas cujo `externalId` já está ativo (reenvio, duplo clique)
   * são ignoradas e contadas em `skipped`.
   */
  async importRows(
    userId: string,
    target: { accountId?: string | null; creditCardId?: string | null },
    rows: ImportRowInput[],
  ): Promise<{ created: number; skipped: number }> {
    const today = await this.userToday(userId);
    const { accountId, card } = await this.resolveSource(
      userId,
      'EXPENSE',
      target.accountId,
      target.creditCardId,
    );
    if (card && rows.some((r) => r.type === 'INCOME')) {
      throw validation('rows', 'Receitas não podem ser lançadas no cartão');
    }

    const categoryIds = [
      ...new Set(rows.map((r) => r.categoryId).filter((id): id is string => !!id)),
    ];
    const categories = new Map(
      (
        await this.prisma.category.findMany({
          where: { id: { in: categoryIds }, userId, deletedAt: null },
          select: { id: true, type: true },
        })
      ).map((c) => [c.id, c.type]),
    );
    for (const row of rows) {
      if (!row.categoryId) continue;
      const type = categories.get(row.categoryId);
      if (!type) throw new AppException(ErrorCode.CATEGORY_NOT_FOUND);
      if (type !== row.type) throw new AppException(ErrorCode.CATEGORY_TYPE_MISMATCH);
    }

    const active = new Set(
      (
        await this.prisma.transaction.findMany({
          where: { userId, deletedAt: null, externalId: { in: rows.map((r) => r.externalId) } },
          select: { externalId: true },
        })
      ).map((t) => t.externalId),
    );
    const fresh = rows.filter((r) => {
      if (active.has(r.externalId)) return false;
      active.add(r.externalId);
      return true;
    });

    await this.prisma.$transaction(
      async (tx) => {
        for (const row of fresh) {
          await this.insertRow(tx, {
            userId,
            type: row.type,
            amount: toDecimal(row.amount),
            description: row.description,
            notes: null,
            searchText: transactionSearchText(row.description, null),
            date: row.date,
            status: resolveStatus(undefined, row.date, today),
            accountId,
            creditCardId: card?.id ?? null,
            card,
            categoryId: row.categoryId ?? null,
            externalId: row.externalId,
            tagIds: [],
          });
        }
      },
      // Um extrato de vários meses passa de mil consultas; o padrão de 5 s não basta.
      { timeout: 60_000 },
    );

    const months = [
      ...new Set(fresh.filter((r) => r.type === 'EXPENSE').map((r) => r.date.slice(0, 7))),
    ];
    if (months.length) await this.budgets.evaluateAlerts(userId, months);
    return { created: fresh.length, skipped: rows.length - fresh.length };
  }

  async createTransfer(userId: string, dto: CreateTransferDto): Promise<TransactionDto> {
    if (dto.fromAccountId.toLowerCase() === dto.toAccountId.toLowerCase()) {
      throw new AppException(ErrorCode.SAME_ACCOUNT_TRANSFER);
    }
    const today = await this.userToday(userId);
    await this.resolveAccount(userId, dto.fromAccountId, true);
    await this.resolveAccount(userId, dto.toAccountId, true);
    const description = dto.description ?? 'Transferência';

    const id = await this.prisma.$transaction((tx) =>
      this.insertRow(tx, {
        userId,
        type: 'TRANSFER',
        amount: toDecimal(dto.amount),
        description,
        notes: dto.notes ?? null,
        searchText: transactionSearchText(description, dto.notes),
        date: dto.date,
        status: resolveStatus(dto.status, dto.date, today),
        accountId: dto.fromAccountId,
        transferAccountId: dto.toAccountId,
        categoryId: null,
        tagIds: [],
      }),
    );
    const transfer = await this.get(userId, id);
    await this.notifyNew(userId, transfer, 1);
    return transfer;
  }

  async duplicate(userId: string, id: string): Promise<TransactionDto> {
    const source = await this.findOwned(userId, id);
    if (source.type === 'TRANSFER' && source.invoiceId) {
      throw validation('id', 'Pagamentos de fatura não podem ser duplicados');
    }
    const today = await this.userToday(userId);
    const card = source.creditCardId
      ? await this.resolveCard(userId, source.creditCardId, true)
      : null;
    if (source.accountId) await this.resolveAccount(userId, source.accountId, true);
    if (source.transferAccountId) await this.resolveAccount(userId, source.transferAccountId, true);

    const newId = await this.prisma.$transaction((tx) =>
      this.insertRow(tx, {
        userId,
        type: source.type,
        amount: source.amount,
        description: source.description,
        notes: source.notes,
        searchText: transactionSearchText(source.description, source.notes),
        date: today,
        status: 'CLEARED',
        accountId: source.accountId,
        transferAccountId: source.transferAccountId,
        creditCardId: card?.id ?? null,
        card,
        categoryId: source.categoryId,
        tagIds: source.tags.map((t) => t.tag.id),
      }),
    );
    const duplicated = await this.get(userId, newId);
    await this.withBudgetAlerts(userId, [duplicated]);
    return duplicated;
  }

  // ─────────────────────────── Edição ───────────────────────────

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
    scope: Scope = 'single',
  ): Promise<TransactionDto[]> {
    const current = await this.findOwned(userId, id);
    if (
      (dto.amount !== undefined ||
        dto.date !== undefined ||
        dto.status !== undefined ||
        dto.accountId !== undefined ||
        dto.fromAccountId !== undefined ||
        dto.toAccountId !== undefined ||
        dto.creditCardId !== undefined) &&
      (await this.isLinked(id))
    ) {
      throw new AppException(ErrorCode.LINKED_TRANSACTION);
    }
    const isTransfer = current.type === 'TRANSFER';
    if (isTransfer && (dto.accountId !== undefined || dto.categoryId)) {
      throw validation(
        'accountId',
        'Em transferências use fromAccountId/toAccountId (sem categoria)',
      );
    }
    if (!isTransfer && (dto.fromAccountId !== undefined || dto.toAccountId !== undefined)) {
      throw validation('fromAccountId', 'fromAccountId/toAccountId só se aplicam a transferências');
    }
    if (dto.description === null || dto.amount === null || dto.date === null) {
      throw validation('description', 'Campos obrigatórios não podem ser nulos');
    }
    const isPayment = isTransfer && Boolean(current.invoiceId);
    if (isPayment && (dto.toAccountId !== undefined || dto.creditCardId !== undefined)) {
      throw validation(
        'toAccountId',
        'Pagamentos de fatura só permitem alterar conta, valor, data e textos',
      );
    }
    if (dto.creditCardId !== undefined && current.type !== 'EXPENSE') {
      throw validation('creditCardId', 'Somente despesas podem ser lançadas no cartão');
    }
    if (dto.creditCardId !== undefined && dto.accountId !== undefined) {
      throw validation('creditCardId', 'Informe conta OU cartão, não ambos');
    }

    const today = await this.userToday(userId);
    // Troca conta ↔ cartão (despesas): cartão novo precisa estar ativo.
    const newCard =
      dto.creditCardId !== undefined && dto.creditCardId !== current.creditCardId
        ? await this.resolveCard(userId, dto.creditCardId, true)
        : null;
    const switchToAccount = !isTransfer && dto.accountId !== undefined;
    const switchToCard = dto.creditCardId !== undefined;
    const cardCache = new Map<string, CardRef>();
    const cardFor = async (cardId: string): Promise<CardRef> => {
      const cached = cardCache.get(cardId) ?? (newCard?.id === cardId ? newCard : null);
      if (cached) return cached;
      const loaded = await this.resolveCard(userId, cardId, false);
      cardCache.set(cardId, loaded);
      return loaded;
    };

    // Referências novas validadas uma vez (conta nova não pode estar arquivada).
    const accountId = isTransfer
      ? (dto.fromAccountId ?? current.accountId)
      : (dto.accountId ?? current.accountId);
    const transferAccountId = isTransfer ? (dto.toAccountId ?? current.transferAccountId) : null;
    if (accountId && accountId !== current.accountId) {
      await this.resolveAccount(userId, accountId, true);
    }
    if (transferAccountId && transferAccountId !== current.transferAccountId) {
      await this.resolveAccount(userId, transferAccountId, true);
    }
    if (isTransfer && accountId === transferAccountId) {
      throw new AppException(ErrorCode.SAME_ACCOUNT_TRANSFER);
    }
    let categoryId = current.categoryId;
    if (dto.categoryId === null) categoryId = null;
    else if (dto.categoryId) {
      categoryId = await this.resolveCategory(userId, dto.categoryId, current.type as CategoryType);
    }

    // Campos da própria linha.
    const date = dto.date ?? fromDbDate(current.date);
    const status: ApiStatus =
      dto.status !== undefined
        ? resolveStatus(dto.status, date, today)
        : current.status === 'CLEARED' && date > today
          ? 'PENDING' // mover para o futuro sem status explícito vira pendente
          : current.status === 'CLEARED'
            ? 'CLEARED'
            : 'PENDING';

    // Membros da série afetados (além da própria linha).
    const members = scope === 'single' ? [] : await this.seriesMembers(userId, current, scope);
    const isRecurring = Boolean(current.recurringTransactionId);

    const ids = await this.prisma.$transaction(async (tx) => {
      const tagIds = dto.tags ? await this.tags.resolveIds(tx, userId, dto.tags) : undefined;
      const shared = {
        description: dto.description,
        notes: dto.notes === undefined ? undefined : dto.notes,
        accountId:
          dto.accountId !== undefined || dto.fromAccountId !== undefined ? accountId : undefined,
        transferAccountId: dto.toAccountId !== undefined ? transferAccountId : undefined,
        categoryId: dto.categoryId !== undefined ? categoryId : undefined,
      };

      const deltas: Map<string, Prisma.Decimal>[] = [];
      const invoicePairs: Parameters<typeof invoiceDelta> = [];
      const changed: string[] = [];

      const updateRow = async (
        row: TransactionWithRelations,
        own: { amount?: Prisma.Decimal; date?: DateOnly; status?: ApiStatus },
      ) => {
        const creditCardId = switchToCard
          ? (dto.creditCardId ?? null)
          : switchToAccount
            ? null
            : row.creditCardId;
        const rowDate = own.date ?? fromDbDate(row.date);
        let invoiceId = isPayment ? row.invoiceId : null;
        if (creditCardId && !isPayment) {
          // Só reclassifica a fatura se a data ou o cartão mudaram (ciclo novo não re-agrupa).
          invoiceId =
            creditCardId === row.creditCardId && rowDate === fromDbDate(row.date) && row.invoiceId
              ? row.invoiceId
              : await ensureInvoice(
                  tx,
                  await cardFor(creditCardId),
                  invoiceFor(await cardFor(creditCardId), rowDate),
                );
        }
        const next = {
          type: row.type,
          amount: own.amount ?? row.amount,
          status: own.status ?? row.status,
          accountId: switchToCard
            ? null
            : shared.accountId !== undefined
              ? shared.accountId
              : row.accountId,
          transferAccountId:
            shared.transferAccountId !== undefined
              ? shared.transferAccountId
              : row.transferAccountId,
          creditCardId,
          invoiceId,
        };
        const description = shared.description ?? row.description;
        const notes = shared.notes !== undefined ? shared.notes : row.notes;
        await tx.transaction.update({
          where: { id: row.id },
          data: {
            amount: next.amount,
            status: next.status,
            date: own.date ? toDbDate(own.date) : undefined,
            description,
            notes,
            searchText: transactionSearchText(description, notes),
            accountId: next.accountId,
            transferAccountId: next.transferAccountId,
            creditCardId: next.creditCardId,
            invoiceId: next.invoiceId,
            categoryId: shared.categoryId,
          },
        });
        if (tagIds) {
          await tx.transactionTag.deleteMany({ where: { transactionId: row.id } });
          await tx.transactionTag.createMany({
            data: tagIds.map((tagId) => ({ transactionId: row.id, tagId })),
          });
        }
        deltas.push(balanceDelta(row, next));
        invoicePairs.push([row, next]);
        changed.push(row.id);
      };

      await updateRow(current, {
        amount: dto.amount !== undefined ? toDecimal(dto.amount) : undefined,
        date,
        status,
      });
      // Em séries: data e status nunca propagam; valor propaga só em recorrências.
      for (const member of members) {
        await updateRow(member, {
          amount: isRecurring && dto.amount !== undefined ? toDecimal(dto.amount) : undefined,
        });
      }

      if (isRecurring && scope !== 'single' && current.recurringTransactionId) {
        await tx.recurringTransaction.update({
          where: { id: current.recurringTransactionId },
          data: {
            amount: dto.amount !== undefined ? toDecimal(dto.amount) : undefined,
            description: shared.description,
            notes: shared.notes,
            accountId: switchToCard ? null : (shared.accountId ?? undefined),
            creditCardId: switchToCard ? dto.creditCardId : switchToAccount ? null : undefined,
            categoryId: shared.categoryId,
          },
        });
      }

      await applyBalanceDelta(tx, mergeDeltas(...deltas));
      await applyInvoiceDelta(tx, invoiceDelta(...invoicePairs));
      return changed;
    });

    return this.withBudgetAlerts(userId, await this.fetchMany(ids), [current, ...members]);
  }

  async setStatus(userId: string, id: string, status: ApiStatus): Promise<TransactionDto> {
    const current = await this.findOwned(userId, id);
    if (await this.isLinked(id)) throw new AppException(ErrorCode.LINKED_TRANSACTION);
    // Status não se aplica a compras no cartão: no-op.
    if (current.type === 'EXPENSE' && current.creditCardId) return toTransactionDto(current);
    const today = await this.userToday(userId);
    resolveStatus(status, fromDbDate(current.date), today);
    if (current.status !== status) {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.transaction.updateMany({
          where: { id, status: current.status },
          data: { status },
        });
        if (count === 1) {
          await applyBalanceDelta(tx, balanceDelta(current, { ...current, status }));
          await applyInvoiceDelta(tx, invoiceDelta([current, { ...current, status }]));
        }
      });
    }
    return this.get(userId, id);
  }

  // ─────────────────────────── Exclusão ───────────────────────────

  /** Hard delete. Em recorrências, `future`/`all` também desativam a série. */
  async remove(userId: string, id: string, scope: Scope = 'single'): Promise<void> {
    const current = await this.findOwned(userId, id);
    if (await this.isLinked(id)) throw new AppException(ErrorCode.LINKED_TRANSACTION);
    const members = scope === 'single' ? [] : await this.seriesMembers(userId, current, scope);
    const rows = [current, ...members];

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, userId } });
      await applyBalanceDelta(tx, mergeDeltas(...rows.map((row) => balanceDelta(row, null))));
      await applyInvoiceDelta(
        tx,
        invoiceDelta(...rows.map((row): [typeof row, null] => [row, null])),
      );

      if (current.recurringTransactionId && scope !== 'single') {
        const endDate = addDays(fromDbDate(current.date), -1);
        await tx.recurringTransaction.update({
          where: { id: current.recurringTransactionId },
          data: {
            active: false,
            nextRunAt: null,
            ...(scope === 'future' ? { endDate: toDbDate(endDate) } : {}),
          },
        });
      }
    });
  }

  // ─────────────────────────── Internos ───────────────────────────

  async buildWhere(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<Prisma.TransactionWhereInput> {
    const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: toDbDate(query.from) } : {}),
        ...(query.to ? { lte: toDbDate(query.to) } : {}),
      };
    }
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.accountId) {
      where.OR = [{ accountId: query.accountId }, { transferAccountId: query.accountId }];
    }
    if (query.categoryId) {
      const ids = [query.categoryId];
      if (query.includeSubcategories !== false) {
        const children = await this.prisma.category.findMany({
          where: { userId, parentId: query.categoryId },
          select: { id: true },
        });
        ids.push(...children.map((c) => c.id));
      }
      where.categoryId = { in: ids };
    }
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };
    if (query.creditCardId) where.creditCardId = query.creditCardId;
    const q = query.q ? normalizeSearch(query.q) : '';
    if (q) where.searchText = { contains: q };
    if (query.minAmount || query.maxAmount) {
      where.amount = {
        ...(query.minAmount ? { gte: toDecimal(query.minAmount) } : {}),
        ...(query.maxAmount ? { lte: toDecimal(query.maxAmount) } : {}),
      };
    }
    return where;
  }

  private async insertRow(
    tx: Tx,
    input: {
      userId: string;
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
      amount: Prisma.Decimal;
      description: string;
      notes: string | null;
      searchText: string;
      date: DateOnly;
      status: ApiStatus;
      accountId: string | null;
      transferAccountId?: string | null;
      creditCardId?: string | null;
      /** Cartão da compra: define a fatura pela data. */
      card?: CardRef | null;
      invoiceId?: string | null;
      categoryId: string | null;
      installmentGroupId?: string;
      installmentNumber?: number;
      installmentTotal?: number;
      externalId?: string | null;
      tagIds: string[];
    },
  ): Promise<string> {
    const { tagIds, date, card, ...data } = input;
    const invoiceId =
      data.invoiceId ??
      (card && data.type === 'EXPENSE'
        ? await ensureInvoice(tx, card, invoiceFor(card, date))
        : null);
    const row = await tx.transaction.create({
      data: {
        ...data,
        invoiceId,
        date: toDbDate(date),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    await applyBalanceDelta(tx, balanceDelta(null, row));
    await applyInvoiceDelta(tx, invoiceDelta([null, row]));
    return row.id;
  }

  /** Demais membros da série (parcelas ou recorrência) conforme o escopo. */
  private async seriesMembers(
    userId: string,
    current: TransactionWithRelations,
    scope: Exclude<Scope, 'single'>,
  ): Promise<TransactionWithRelations[]> {
    let where: Prisma.TransactionWhereInput | null = null;
    if (current.installmentGroupId) {
      where = {
        installmentGroupId: current.installmentGroupId,
        ...(scope === 'future'
          ? { installmentNumber: { gt: current.installmentNumber ?? 0 } }
          : {}),
      };
    } else if (current.recurringTransactionId) {
      where = {
        recurringTransactionId: current.recurringTransactionId,
        ...(scope === 'future' ? { date: { gte: current.date } } : {}),
      };
    }
    if (!where) return [];
    return this.prisma.transaction.findMany({
      where: { ...where, userId, deletedAt: null, id: { not: current.id } },
      include: TRANSACTION_INCLUDE,
    });
  }

  private async fetchMany(ids: string[]): Promise<TransactionDto[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { id: { in: ids } },
      include: TRANSACTION_INCLUDE,
      orderBy: [{ date: 'asc' }, { installmentNumber: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toTransactionDto);
  }

  private async findOwned(userId: string, id: string, db: Db = this.prisma) {
    const row = await db.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: TRANSACTION_INCLUDE,
    });
    if (!row) throw new AppException(ErrorCode.TRANSACTION_NOT_FOUND);
    return row;
  }

  private async userToday(userId: string): Promise<DateOnly> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayIn(user?.timezone ?? 'America/Sao_Paulo');
  }

  /** Conta do usuário (não excluída); `forNew` exige que esteja ativa. */
  private async resolveAccount(userId: string, id: string, forNew: boolean) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
    if (forNew && account.status !== 'ACTIVE') throw new AppException(ErrorCode.ACCOUNT_ARCHIVED);
    return account;
  }

  /** Lançamentos gerados por investimentos/dívidas só mudam de valor pela origem. */
  private async isLinked(id: string): Promise<boolean> {
    const [investment, liability] = await Promise.all([
      this.prisma.investmentTransaction.count({ where: { transactionId: id } }),
      this.prisma.liabilityPayment.count({ where: { transactionId: id } }),
    ]);
    return investment + liability > 0;
  }

  /** Origem do lançamento: receita → conta; despesa → exatamente um entre conta e cartão. */
  private async resolveSource(
    userId: string,
    type: 'INCOME' | 'EXPENSE',
    accountId: string | null | undefined,
    creditCardId: string | null | undefined,
  ): Promise<{ accountId: string | null; card: CardRef | null }> {
    if (type === 'INCOME' && creditCardId) {
      throw validation('creditCardId', 'Receitas não podem ser lançadas no cartão');
    }
    if (Boolean(accountId) === Boolean(creditCardId)) {
      throw validation(
        accountId ? 'creditCardId' : 'accountId',
        type === 'INCOME' ? 'Informe a conta' : 'Informe a conta OU o cartão da despesa',
      );
    }
    if (creditCardId)
      return { accountId: null, card: await this.resolveCard(userId, creditCardId, true) };
    await this.resolveAccount(userId, accountId as string, true);
    return { accountId: accountId as string, card: null };
  }

  /** Cartão do usuário (não excluído); `forNew` exige status ACTIVE. */
  async resolveCard(userId: string, id: string, forNew: boolean): Promise<CardRef> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, userId: true, closingDay: true, dueDay: true, status: true },
    });
    if (!card) throw new AppException(ErrorCode.CARD_NOT_FOUND);
    if (forNew && card.status !== 'ACTIVE') throw new AppException(ErrorCode.CARD_UNAVAILABLE);
    return card;
  }

  private async resolveCategory(userId: string, id: string, type: CategoryType): Promise<string> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, type: true },
    });
    if (!category) throw new AppException(ErrorCode.CATEGORY_NOT_FOUND);
    if (category.type !== type) throw new AppException(ErrorCode.CATEGORY_TYPE_MISMATCH);
    return category.id;
  }
}
