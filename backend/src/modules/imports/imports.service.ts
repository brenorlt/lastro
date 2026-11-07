import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { addDays, fromDbDate } from '../../common/utils/date-only.js';
import { Decimal } from '../../common/utils/money.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CategorySuggesterService } from '../categories/category-suggester.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import type {
  CommitImportDto,
  ImportPreviewDto,
  ImportResultDto,
  PreviewImportDto,
} from './dto/import.dto.js';
import { MAX_IMPORT_ROWS } from './dto/import.dto.js';
import {
  autoInvert,
  buildPreview,
  DUPLICATE_WINDOW_DAYS,
  type ExistingEntry,
  lineExternalIds,
  type TargetKind,
} from './import.calc.js';
import { parseStatement } from './parsers/parse-statement.js';
import { type ParsedStatement, StatementParseError } from './parsers/statement.types.js';

function validation(field: string, message: string): AppException {
  return new AppException(ErrorCode.VALIDATION_ERROR, { details: [{ field, message }] });
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly categories: CategorySuggesterService,
  ) {}

  /** Lê o extrato e devolve as linhas classificadas, sem gravar nada. */
  async preview(
    userId: string,
    file: Express.Multer.File | undefined,
    dto: PreviewImportDto,
  ): Promise<ImportPreviewDto> {
    if (!file?.buffer.length) throw validation('file', 'Envie o arquivo do extrato');
    const target = await this.resolveTarget(userId, dto);

    let parsed: ParsedStatement;
    try {
      parsed = parseStatement(file.buffer);
    } catch (error) {
      if (!(error instanceof StatementParseError)) throw error;
      throw new AppException(ErrorCode.IMPORT_UNREADABLE, {
        details: [{ field: 'file', message: error.message }],
        cause: error,
      });
    }
    if (parsed.lines.length === 0) throw new AppException(ErrorCode.IMPORT_EMPTY);
    if (parsed.lines.length > MAX_IMPORT_ROWS) {
      throw validation(
        'file',
        `O extrato tem ${parsed.lines.length} lançamentos; o limite é ${MAX_IMPORT_ROWS}. Exporte um período menor`,
      );
    }

    const signsInverted = autoInvert(target.kind, parsed) !== (dto.invertSigns ?? false);
    const [existing, suggest] = await Promise.all([
      this.existingEntries(userId, target, parsed),
      this.categories.forUser(userId),
    ]);
    const rows = buildPreview({
      targetKind: target.kind,
      targetId: target.id,
      lines: parsed.lines,
      invert: signsInverted,
      existing,
      suggest,
    });

    return {
      format: parsed.format,
      statementKind: parsed.kind,
      target: {
        kind: target.kind,
        id: target.id,
        name: target.name,
        currentBalance: target.currentBalance?.toFixed(2) ?? null,
      },
      statementBalance: parsed.balance
        ? { amount: parsed.balance.amount.toFixed(2), date: parsed.balance.date }
        : null,
      signsInverted,
      rows,
    };
  }

  commit(userId: string, dto: CommitImportDto): Promise<ImportResultDto> {
    return this.transactions.importRows(
      userId,
      { accountId: dto.accountId, creditCardId: dto.creditCardId },
      dto.rows,
    );
  }

  private async resolveTarget(
    userId: string,
    dto: PreviewImportDto,
  ): Promise<{ kind: TargetKind; id: string; name: string; currentBalance: Decimal | null }> {
    if (Boolean(dto.accountId) === Boolean(dto.creditCardId)) {
      throw validation('accountId', 'Escolha a conta OU o cartão do extrato');
    }
    if (dto.creditCardId) {
      const card = await this.transactions.resolveCard(userId, dto.creditCardId, true);
      const { name } = await this.prisma.creditCard.findUniqueOrThrow({
        where: { id: card.id },
        select: { name: true },
      });
      return { kind: 'CARD', id: card.id, name, currentBalance: null };
    }
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId, deletedAt: null },
      select: { id: true, name: true, status: true, currentBalance: true },
    });
    if (!account) throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
    if (account.status !== 'ACTIVE') throw new AppException(ErrorCode.ACCOUNT_ARCHIVED);
    return { kind: 'ACCOUNT', ...account };
  }

  /**
   * Lançamentos do destino no período do extrato (com folga para a janela de duplicata), com o
   * sinal visto pelo banco: na conta, receita e transferência recebida entram; despesa e
   * transferência enviada (inclui pagamento de fatura) saem. No cartão, só compras.
   */
  private async existingEntries(
    userId: string,
    target: { kind: TargetKind; id: string },
    parsed: ParsedStatement,
  ): Promise<ExistingEntry[]> {
    const dates = parsed.lines.map((l) => l.date).sort();
    const range = {
      gte: new Date(`${addDays(dates[0], -DUPLICATE_WINDOW_DAYS)}T00:00:00Z`),
      lte: new Date(`${addDays(dates[dates.length - 1], DUPLICATE_WINDOW_DAYS)}T00:00:00Z`),
    };
    const ownership =
      target.kind === 'CARD'
        ? { creditCardId: target.id, type: 'EXPENSE' as const }
        : { OR: [{ accountId: target.id }, { transferAccountId: target.id }] };

    // Já importados casam pelo id mesmo fora do período (ex.: data corrigida depois).
    const ids = lineExternalIds(target.kind, target.id, parsed.lines);
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [{ date: range, ...ownership }, { externalId: { in: ids } }],
      },
      select: { type: true, amount: true, date: true, accountId: true, externalId: true },
    });

    return rows.map((t) => {
      const outflow = t.type === 'EXPENSE' || (t.type === 'TRANSFER' && t.accountId === target.id);
      return {
        date: fromDbDate(t.date),
        signed: outflow ? new Decimal(t.amount).negated() : new Decimal(t.amount),
        externalId: t.externalId,
      };
    });
  }
}
