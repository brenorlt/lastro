import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  addDays,
  type DateOnly,
  fromDbDate,
  todayIn,
  toDbDate,
} from '../../common/utils/date-only.js';
import { transactionSearchText } from '../../common/utils/search-text.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, RecurringTransaction } from '../../generated/prisma/client.js';
import { balanceEffects, mergeDeltas } from './balance.js';
import { applyBalanceDelta } from './balance-writer.js';
import { invoiceFor } from '../cards/invoice.calc.js';
import { applyInvoiceDelta, ensureInvoice, invoiceDelta } from '../cards/invoice-writer.js';
import { nextOccurrenceAfter, recurrenceDates } from './schedule.js';

/** Quantos dias à frente as ocorrências ficam materializadas. */
export const RECURRENCE_HORIZON_DAYS = 60;
export const MAX_OCCURRENCES_PER_RUN = 500;
const ENGINE_INTERVAL_MS = 60 * 60 * 1000;

class ConcurrentMaterializationError extends Error {}

export interface MaterializeOptions {
  /** Status da 1ª ocorrência na criação da série (as demais seguem autoConfirm). */
  firstStatus?: 'CLEARED' | 'PENDING';
  tagIds?: string[];
}

@Injectable()
export class RecurrenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecurrenceService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;
    this.timer = setInterval(() => void this.run(), ENGINE_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 10_000).unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /**
   * Gera as ocorrências após o cursor `lastMaterializedDate` até hoje + 60 dias (e até endDate).
   * O avanço do cursor é condicional, então execuções concorrentes não duplicam lançamentos.
   * Retorna os ids criados.
   */
  async materialize(
    tx: Prisma.TransactionClient,
    template: RecurringTransaction,
    today: DateOnly,
    options: MaterializeOptions = {},
  ): Promise<string[]> {
    const start = fromDbDate(template.startDate);
    const after = template.lastMaterializedDate ? fromDbDate(template.lastMaterializedDate) : null;
    const endDate = template.endDate ? fromDbDate(template.endDate) : null;
    const dates = recurrenceDates({
      start,
      frequency: template.frequency,
      interval: template.interval,
      endDate,
      until: addDays(today, RECURRENCE_HORIZON_DAYS),
      after,
      limit: MAX_OCCURRENCES_PER_RUN,
    });
    if (!dates.length) return [];

    // Compras recorrentes no cartão: cada ocorrência vai para a fatura da sua data.
    const card = template.creditCardId
      ? await tx.creditCard.findUnique({
          where: { id: template.creditCardId },
          select: { id: true, userId: true, closingDay: true, dueDay: true },
        })
      : null;
    const invoiceIds = new Map<DateOnly, string>();
    if (card && template.type === 'EXPENSE') {
      for (const date of dates)
        invoiceIds.set(date, await ensureInvoice(tx, card, invoiceFor(card, date)));
    }

    const rows = dates.map((date, index) => {
      const status =
        index === 0 && after === null && options.firstStatus
          ? options.firstStatus
          : template.autoConfirm && date <= today
            ? 'CLEARED'
            : 'PENDING';
      return {
        id: randomUUID(),
        userId: template.userId,
        type: template.type,
        amount: template.amount,
        description: template.description,
        notes: template.notes,
        searchText: transactionSearchText(template.description, template.notes),
        date: toDbDate(date),
        status,
        accountId: template.accountId,
        transferAccountId: template.transferAccountId,
        creditCardId: template.creditCardId,
        invoiceId: invoiceIds.get(date) ?? null,
        categoryId: template.categoryId,
        recurringTransactionId: template.id,
      } satisfies Prisma.TransactionCreateManyInput;
    });

    await tx.transaction.createMany({ data: rows });
    if (options.tagIds?.length) {
      await tx.transactionTag.createMany({
        data: rows.flatMap((row) =>
          (options.tagIds ?? []).map((tagId) => ({ transactionId: row.id, tagId })),
        ),
      });
    }

    const last = dates[dates.length - 1];
    const next = nextOccurrenceAfter(start, template.frequency, template.interval, last, endDate);
    const { count } = await tx.recurringTransaction.updateMany({
      where: { id: template.id, lastMaterializedDate: template.lastMaterializedDate },
      data: {
        lastMaterializedDate: toDbDate(last),
        nextRunAt: next ? toDbDate(next) : null,
        lastRunAt: new Date(),
      },
    });
    if (count !== 1) throw new ConcurrentMaterializationError();

    await applyInvoiceDelta(
      tx,
      invoiceDelta(...rows.map((row): [null, typeof row] => [null, row])),
    );
    await applyBalanceDelta(
      tx,
      mergeDeltas(
        ...rows.map((row) =>
          balanceEffects({ ...row, amount: row.amount, transferAccountId: row.transferAccountId }),
        ),
      ),
    );
    return rows.map((row) => row.id);
  }

  /**
   * Motor (a cada hora; também chamável nos testes): materializa séries ativas e confirma
   * ocorrências vencidas de séries com autoConfirm, ajustando saldos.
   */
  async run(now: Date = new Date()): Promise<{ created: number; confirmed: number }> {
    let created = 0;
    let confirmed = 0;
    const templates = await this.prisma.recurringTransaction.findMany({
      where: { active: true, deletedAt: null },
      include: {
        user: { select: { timezone: true, deletedAt: true } },
        account: { select: { status: true, deletedAt: true } },
        creditCard: { select: { status: true, deletedAt: true } },
      },
    });

    const createdByUser = new Map<string, number>();
    for (const template of templates) {
      if (template.user.deletedAt) continue;
      const today = todayIn(template.user.timezone, now);
      const accountUsable = template.creditCard
        ? !template.creditCard.deletedAt && template.creditCard.status === 'ACTIVE'
        : template.account && !template.account.deletedAt && template.account.status === 'ACTIVE';
      try {
        await this.prisma.$transaction(async (tx) => {
          if (accountUsable) {
            const count = (await this.materialize(tx, template, today)).length;
            created += count;
            if (count)
              createdByUser.set(template.userId, (createdByUser.get(template.userId) ?? 0) + count);
          }
          if (template.autoConfirm) confirmed += await this.confirmDue(tx, template.id, today);
        });
      } catch (error) {
        if (error instanceof ConcurrentMaterializationError) continue;
        this.logger.error(
          { templateId: template.id, err: error instanceof Error ? error.message : String(error) },
          'Falha ao processar recorrência',
        );
      }
    }
    for (const [userId, count] of createdByUser) {
      await this.notifications.notify(
        userId,
        {
          type: 'RECURRING_CREATED',
          title: `${count} ${count === 1 ? 'lançamento recorrente agendado' : 'lançamentos recorrentes agendados'}`,
          body: 'Novas ocorrências das suas recorrências foram adicionadas aos próximos dias.',
          data: { count, href: '/lancamentos' },
        },
        { topic: 'recurring' },
      );
    }
    if (created || confirmed) this.logger.log({ created, confirmed }, 'Recorrências processadas');
    return { created, confirmed };
  }

  private async confirmDue(
    tx: Prisma.TransactionClient,
    templateId: string,
    today: DateOnly,
  ): Promise<number> {
    const due = await tx.transaction.findMany({
      where: {
        recurringTransactionId: templateId,
        status: 'PENDING',
        date: { lte: toDbDate(today) },
      },
    });
    let confirmed = 0;
    for (const row of due) {
      const { count } = await tx.transaction.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'CLEARED' },
      });
      if (count !== 1) continue;
      confirmed += 1;
      await applyBalanceDelta(tx, balanceEffects({ ...row, status: 'CLEARED' }));
    }
    return confirmed;
  }
}
