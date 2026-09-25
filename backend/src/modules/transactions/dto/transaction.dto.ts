import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '../../../common/validation/date-only.decorator.js';
import { IsMoneyString } from '../../../common/validation/decorators.js';
import { RecurrenceFrequency } from '../../../generated/prisma/enums.js';

export const MAX_TRANSACTION_AMOUNT = '999999999999.99';
const FREQUENCIES = Object.values(RecurrenceFrequency);
const STATUSES = ['CLEARED', 'PENDING'] as const;
type ApiStatus = (typeof STATUSES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const unlessUndefined = (_: object, value: unknown) => value !== undefined;
const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : v))
    : value;
const unlessNil = (_: object, value: unknown) => value !== undefined && value !== null;
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Valor positivo (> 0) e até 999.999.999.999,99. */
function IsPositiveAmount(): PropertyDecorator {
  return (target, propertyName) => {
    IsMoneyString()(target, propertyName);
    registerDecorator({
      name: 'isPositiveAmount',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: 'O valor deve ser maior que zero e no máximo 999999999999.99' },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          Number(value) > 0 &&
          value.replace(/^0+(?=\d)/, '').split('.')[0].length <= 12,
      },
    });
  };
}

// ───────────────────────── Respostas ─────────────────────────

export class TransactionAccountRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
}

export class TransactionCategoryRefDto extends TransactionAccountRefDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) parentId: string | null;
}

export class CreditCardRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ example: 'VISA' }) brand: string;
  @ApiProperty({ type: String, nullable: true }) lastFourDigits: string | null;
}

export class InvoiceRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2026-10' }) referenceMonth: string;
  @ApiProperty({ example: '2026-10-10' }) dueDate: string;
}

export class TagRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
}

export class InstallmentInfoDto {
  @ApiProperty({ format: 'uuid' }) groupId: string;
  @ApiProperty({ example: 3 }) number: number;
  @ApiProperty({ example: 10 }) total: number;
}

export class RecurringInfoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: FREQUENCIES }) frequency: RecurrenceFrequency;
  @ApiProperty() interval: number;
  @ApiProperty({ type: String, nullable: true, example: '2026-12-31' }) endDate: string | null;
  @ApiProperty() active: boolean;
}

export class TransactionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['INCOME', 'EXPENSE', 'TRANSFER'] }) type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  @ApiProperty({ example: '150.00' }) amount: string;
  @ApiProperty() description: string;
  @ApiProperty({ example: '2026-09-24' }) date: string;
  @ApiProperty({ enum: STATUSES }) status: ApiStatus;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ type: TransactionAccountRefDto, nullable: true })
  account: TransactionAccountRefDto | null;
  @ApiProperty({ type: TransactionAccountRefDto, nullable: true })
  transferAccount: TransactionAccountRefDto | null;
  @ApiProperty({ type: TransactionCategoryRefDto, nullable: true })
  category: TransactionCategoryRefDto | null;
  @ApiProperty({ type: () => CreditCardRefDto, nullable: true })
  creditCard: CreditCardRefDto | null;
  @ApiProperty({ type: () => InvoiceRefDto, nullable: true }) invoice: InvoiceRefDto | null;
  @ApiProperty({ type: [TagRefDto] }) tags: TagRefDto[];
  @ApiProperty({ type: InstallmentInfoDto, nullable: true }) installment: InstallmentInfoDto | null;
  @ApiProperty({ type: RecurringInfoDto, nullable: true }) recurring: RecurringInfoDto | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class TransactionTotalsDto {
  @ApiProperty({ example: '5000.00' }) income: string;
  @ApiProperty({ example: '3200.50' }) expense: string;
  @ApiProperty({ example: '1799.50' }) net: string;
  @ApiProperty({ example: '0.00' }) pendingIncome: string;
  @ApiProperty({ example: '450.00' }) pendingExpense: string;
}

export class TransactionListMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
  @ApiProperty({ type: TransactionTotalsDto }) totals: TransactionTotalsDto;
}

// ───────────────────────── Entradas ─────────────────────────

export class RepeatDto {
  @ApiProperty({ enum: ['INSTALLMENTS', 'RECURRING'] })
  @IsIn(['INSTALLMENTS', 'RECURRING'], { message: 'Tipo de repetição inválido' })
  kind: 'INSTALLMENTS' | 'RECURRING';

  @ApiPropertyOptional({ minimum: 2, maximum: 60, description: 'INSTALLMENTS: nº de parcelas' })
  @ValidateIf((o: RepeatDto) => o.kind === 'INSTALLMENTS')
  @IsInt({ message: 'Número de parcelas inválido' })
  @Min(2, { message: 'Mínimo de 2 parcelas' })
  @Max(60, { message: 'Máximo de 60 parcelas' })
  count?: number;

  @ApiPropertyOptional({ enum: FREQUENCIES, description: 'RECURRING' })
  @ValidateIf((o: RepeatDto) => o.kind === 'RECURRING')
  @IsIn(FREQUENCIES, { message: 'Frequência inválida' })
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, default: 1 })
  @ValidateIf(unlessUndefined)
  @IsInt({ message: 'Intervalo inválido' })
  @Min(1, { message: 'Intervalo inválido' })
  @Max(12, { message: 'Intervalo máximo é 12' })
  interval?: number;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @ValidateIf(unlessNil)
  @IsDateOnly()
  endDate?: string | null;

  @ApiPropertyOptional({ default: false })
  @ValidateIf(unlessUndefined)
  @IsBoolean({ message: 'Valor inválido' })
  autoConfirm?: boolean;
}

class TransactionFieldsDto {
  @ApiProperty({ example: '150.00' })
  @IsPositiveAmount()
  amount: string;

  @ApiProperty({ example: '2026-09-24' })
  @IsDateOnly()
  date: string;

  @ApiPropertyOptional({
    enum: STATUSES,
    description: 'Padrão: CLEARED se a data ≤ hoje (fuso do usuário), senão PENDING',
  })
  @ValidateIf(unlessUndefined)
  @IsIn(STATUSES, { message: 'Status inválido' })
  status?: ApiStatus;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @ValidateIf(unlessNil)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(500, { message: 'A observação deve ter no máximo 500 caracteres' })
  notes?: string | null;
}

export class CreateTransactionDto extends TransactionFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString({ message: 'Informe a descrição' })
  @MinLength(1, { message: 'Informe a descrição' })
  @MaxLength(120, { message: 'A descrição deve ter no máximo 120 caracteres' })
  description: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] })
  @IsIn(['INCOME', 'EXPENSE'], {
    message: 'Tipo inválido (use /transactions/transfers para transferências)',
  })
  type: 'INCOME' | 'EXPENSE';

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Obrigatório em receitas. Em despesas informe accountId OU creditCardId',
  })
  @ValidateIf(unlessNil)
  @IsUUID('all', { message: 'Conta inválida' })
  accountId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Compra no cartão (somente EXPENSE; não altera saldo de conta)',
  })
  @ValidateIf(unlessNil)
  @IsUUID('all', { message: 'Cartão inválido' })
  creditCardId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @ValidateIf(unlessNil)
  @IsUUID('all', { message: 'Categoria inválida' })
  categoryId?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 10, example: ['viagem', 'trabalho'] })
  @ValidateIf(unlessUndefined)
  @IsArray({ message: 'Tags inválidas' })
  @ArrayMaxSize(10, { message: 'Máximo de 10 tags' })
  @Transform(trimEach)
  @IsString({ each: true, message: 'Tag inválida' })
  @MinLength(1, { each: true, message: 'Tag vazia' })
  @MaxLength(30, { each: true, message: 'Cada tag deve ter no máximo 30 caracteres' })
  tags?: string[];

  @ApiPropertyOptional({ type: RepeatDto })
  @ValidateIf(unlessUndefined)
  @ValidateNested()
  @Type(() => RepeatDto)
  repeat?: RepeatDto;
}

export class CreateTransferDto extends TransactionFieldsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Conta de origem inválida' })
  fromAccountId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Conta de destino inválida' })
  toAccountId: string;

  @ApiPropertyOptional({ default: 'Transferência', maxLength: 120 })
  @ValidateIf(unlessUndefined)
  @Transform(trim)
  @IsString({ message: 'Descrição inválida' })
  @MinLength(1, { message: 'Informe a descrição' })
  @MaxLength(120, { message: 'A descrição deve ter no máximo 120 caracteres' })
  description?: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: '150.00' })
  @ValidateIf(unlessUndefined)
  @IsPositiveAmount()
  amount?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf(unlessUndefined)
  @Transform(trim)
  @IsString({ message: 'Informe a descrição' })
  @MinLength(1, { message: 'Informe a descrição' })
  @MaxLength(120, { message: 'A descrição deve ter no máximo 120 caracteres' })
  description?: string;

  @ApiPropertyOptional({ example: '2026-09-24' })
  @ValidateIf(unlessUndefined)
  @IsDateOnly()
  date?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @ValidateIf(unlessUndefined)
  @IsIn(STATUSES, { message: 'Status inválido' })
  status?: ApiStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Receitas/despesas' })
  @ValidateIf(unlessUndefined)
  @IsUUID('all', { message: 'Conta inválida' })
  accountId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @ValidateIf(unlessNil)
  @IsUUID('all', { message: 'Categoria inválida' })
  categoryId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(unlessNil)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(500, { message: 'A observação deve ter no máximo 500 caracteres' })
  notes?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Substitui o conjunto de tags' })
  @ValidateIf(unlessUndefined)
  @IsArray({ message: 'Tags inválidas' })
  @ArrayMaxSize(10, { message: 'Máximo de 10 tags' })
  @Transform(trimEach)
  @IsString({ each: true, message: 'Tag inválida' })
  @MinLength(1, { each: true, message: 'Tag vazia' })
  @MaxLength(30, { each: true, message: 'Cada tag deve ter no máximo 30 caracteres' })
  tags?: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Despesas: move a compra para o cartão' })
  @ValidateIf(unlessUndefined)
  @IsUUID('all', { message: 'Cartão inválido' })
  creditCardId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Transferências' })
  @ValidateIf(unlessUndefined)
  @IsUUID('all', { message: 'Conta de origem inválida' })
  fromAccountId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Transferências' })
  @ValidateIf(unlessUndefined)
  @IsUUID('all', { message: 'Conta de destino inválida' })
  toAccountId?: string;
}

export const SCOPES = ['single', 'future', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

export class ScopeQueryDto {
  @ApiPropertyOptional({ enum: SCOPES, default: 'single' })
  @IsOptional()
  @IsIn(SCOPES, { message: 'Escopo inválido' })
  scope?: Scope;
}

const SORTS = ['date', 'amount', 'description'] as const;

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptional() @IsDateOnly() from?: string;
  @ApiPropertyOptional({ example: '2026-09-30' }) @IsOptional() @IsDateOnly() to?: string;

  @ApiPropertyOptional({ enum: ['INCOME', 'EXPENSE', 'TRANSFER'] })
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE', 'TRANSFER'], { message: 'Tipo inválido' })
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';

  @ApiPropertyOptional({ format: 'uuid', description: 'Origem ou destino' })
  @IsOptional()
  @IsUUID('all', { message: 'Conta inválida' })
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Categoria inválida' })
  categoryId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'Valor inválido' })
  includeSubcategories?: boolean;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES, { message: 'Status inválido' })
  status?: ApiStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'Tag inválida' })
  tagId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Compras e pagamentos do cartão' })
  @IsOptional()
  @IsUUID('all', { message: 'Cartão inválido' })
  creditCardId?: string;

  @ApiPropertyOptional({ description: 'Busca em descrição e notas (sem diferenciar acentos)' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Busca muito longa' })
  q?: string;

  @ApiPropertyOptional({ example: '10.00' }) @IsOptional() @IsMoneyString() minAmount?: string;
  @ApiPropertyOptional({ example: '500.00' }) @IsOptional() @IsMoneyString() maxAmount?: string;

  @ApiPropertyOptional({ enum: SORTS, default: 'date' })
  @IsOptional()
  @IsIn(SORTS, { message: 'Ordenação inválida' })
  sort?: (typeof SORTS)[number];

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Ordem inválida' })
  order?: 'asc' | 'desc';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page inválido' })
  @Min(1, { message: 'page inválido' })
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize inválido' })
  @Min(1, { message: 'pageSize inválido' })
  @Max(100, { message: 'pageSize máximo é 100' })
  pageSize?: number;
}
