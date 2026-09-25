import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { IsDateOnly } from '../../common/validation/date-only.decorator.js';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_MSG = { message: 'Mês inválido: use AAAA-MM' };

export const REPORT_KINDS = [
  'cash-flow',
  'categories',
  'transactions',
  'net-worth',
  'investments',
  'goals',
  'budget',
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Filtros comuns (todos opcionais; período padrão = mês atual no fuso do usuário). */
export class ReportFiltersDto {
  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsDateOnly() from?: string;
  @ApiPropertyOptional({ example: '2026-06-30' }) @IsOptional() @IsDateOnly() to?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Conta inválida' })
  accountId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Cartão inválido' })
  creditCardId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Inclui subcategorias' })
  @IsOptional()
  @IsUUID('all', { message: 'Categoria inválida' })
  categoryId?: string;
  @ApiPropertyOptional({ enum: ['INCOME', 'EXPENSE'] })
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE'], { message: 'Tipo inválido' })
  type?: 'INCOME' | 'EXPENSE';
}

export class CashFlowQueryDto extends ReportFiltersDto {
  @ApiPropertyOptional({
    enum: ['day', 'week', 'month'],
    default: 'month',
    description: 'day só até 92 dias (acima vira month)',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'], { message: 'Granularidade inválida' })
  granularity?: 'day' | 'week' | 'month';
}

export class ReportTransactionsQueryDto extends ReportFiltersDto {
  @ApiPropertyOptional({ enum: ['date', 'amount', 'description'] })
  @IsOptional()
  @IsIn(['date', 'amount', 'description'], { message: 'Ordenação inválida' })
  sort?: 'date' | 'amount' | 'description';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Ordem inválida' })
  order?: 'asc' | 'desc';
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize inválido' })
  @Min(1, { message: 'pageSize inválido' })
  @Max(500, { message: 'pageSize máximo é 500' })
  pageSize?: number;
}

export class NetWorthReportQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 60, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'months inválido' })
  @Min(1, { message: 'months inválido' })
  @Max(60, { message: 'months máximo é 60' })
  months?: number;
}

export class BudgetReportQueryDto {
  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @Matches(MONTH, MONTH_MSG)
  fromMonth?: string;
  @ApiPropertyOptional({ example: '2026-06' })
  @IsOptional()
  @Matches(MONTH, MONTH_MSG)
  toMonth?: string;
}

/** Export aceita a união dos filtros de todos os relatórios. */
export class ExportQueryDto extends ReportTransactionsQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'pdf'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'pdf'], { message: 'Formato inválido' })
  format?: 'csv' | 'pdf';

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'], { message: 'Granularidade inválida' })
  granularity?: 'day' | 'week' | 'month';

  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'months inválido' })
  @Min(1, { message: 'months inválido' })
  @Max(60, { message: 'months máximo é 60' })
  months?: number;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @Matches(MONTH, MONTH_MSG)
  fromMonth?: string;
  @ApiPropertyOptional({ example: '2026-06' })
  @IsOptional()
  @Matches(MONTH, MONTH_MSG)
  toMonth?: string;
}
