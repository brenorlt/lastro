import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/validation/date-only.decorator.js';
import { IsHexColor } from '../../common/validation/decorators.js';
import { CardBrand } from '../../generated/prisma/enums.js';
import { IsPositiveMoney } from '../budgets/budget.dto.js';
import { TransactionDto } from '../transactions/dto/transaction.dto.js';

const BRANDS = Object.values(CardBrand);
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const present = (_: object, v: unknown) => v !== undefined && v !== null;

export class InvoiceSummaryDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null = fatura virtual (sem lançamentos)',
  })
  id: string | null;
  @ApiProperty({ example: '2026-10' }) referenceMonth: string;
  @ApiProperty({ example: '2026-10-03' }) closingDate: string;
  @ApiProperty({ example: '2026-10-10' }) dueDate: string;
  @ApiProperty({ enum: ['OPEN', 'CLOSED', 'PAID', 'OVERDUE'] }) status: string;
  @ApiProperty() total: string;
  @ApiProperty() paidAmount: string;
  @ApiProperty() remaining: string;
}

export class CardAccountRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
}

export class CardDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) institution: string | null;
  @ApiProperty({ enum: BRANDS }) brand: CardBrand;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) lastFourDigits: string | null;
  @ApiProperty() limit: string;
  @ApiProperty({ description: 'Σ em aberto de todas as faturas (inclui parcelas futuras)' })
  limitUsed: string;
  @ApiProperty({ description: 'Pode ser negativo' }) availableLimit: string;
  @ApiProperty() usagePercent: number;
  @ApiProperty() overLimit: boolean;
  @ApiProperty() closingDay: number;
  @ApiProperty() dueDay: number;
  @ApiProperty() bestPurchaseDay: number;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED', 'BLOCKED'] }) status: string;
  @ApiProperty({ type: CardAccountRefDto, nullable: true })
  paymentAccount: CardAccountRefDto | null;
  @ApiProperty({ type: InvoiceSummaryDto, nullable: true })
  currentInvoice: InvoiceSummaryDto | null;
  @ApiProperty({ type: InvoiceSummaryDto, nullable: true })
  nextDueInvoice: InvoiceSummaryDto | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class CardsMetaDto {
  @ApiProperty() totalLimit: string;
  @ApiProperty() totalUsed: string;
  @ApiProperty() totalAvailable: string;
  @ApiProperty({
    nullable: true,
    example: {
      cardId: 'uuid',
      referenceMonth: '2026-10',
      dueDate: '2026-10-10',
      remaining: '1200.00',
    },
  })
  nextDue: { cardId: string; referenceMonth: string; dueDate: string; remaining: string } | null;
}

export class InvoiceCategoryDto {
  @ApiProperty({ type: String, nullable: true }) categoryId: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
  @ApiProperty() amount: string;
}

export class InvoiceDetailDto extends InvoiceSummaryDto {
  @ApiProperty({ type: [TransactionDto] }) transactions: TransactionDto[];
  @ApiProperty({ type: [TransactionDto] }) payments: TransactionDto[];
  @ApiProperty({ type: [InvoiceCategoryDto] }) byCategory: InvoiceCategoryDto[];
}

export class PaymentResultDto {
  @ApiProperty({ type: InvoiceSummaryDto }) invoice: InvoiceSummaryDto;
  @ApiProperty({ type: TransactionDto }) payment: TransactionDto;
}

export class SpendingPointDto {
  @ApiProperty({ example: '2026-10' }) referenceMonth: string;
  @ApiProperty() total: string;
}

export class CreateCardDto {
  @ApiProperty({ minLength: 1, maxLength: 40 })
  @Transform(trim)
  @IsString({ message: 'Informe o nome do cartão' })
  @MinLength(1, { message: 'Informe o nome do cartão' })
  @MaxLength(40, { message: 'O nome deve ter no máximo 40 caracteres' })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 60 })
  @ValidateIf(present)
  @Transform(trim)
  @IsString({ message: 'Instituição inválida' })
  @MaxLength(60, { message: 'A instituição deve ter no máximo 60 caracteres' })
  institution?: string | null;

  @ApiProperty({ enum: BRANDS }) @IsIn(BRANDS, { message: 'Bandeira inválida' }) brand: CardBrand;
  @ApiProperty({ example: '8000.00' }) @IsPositiveMoney() limit: string;

  @ApiProperty({ minimum: 1, maximum: 31, example: 3 })
  @IsInt({ message: 'Dia de fechamento inválido' })
  @Min(1, { message: 'Dia de fechamento inválido' })
  @Max(31, { message: 'Dia de fechamento inválido' })
  closingDay: number;

  @ApiProperty({ minimum: 1, maximum: 31, example: 10 })
  @IsInt({ message: 'Dia de vencimento inválido' })
  @Min(1, { message: 'Dia de vencimento inválido' })
  @Max(31, { message: 'Dia de vencimento inválido' })
  dueDay: number;

  @ApiProperty({ example: '#8A05BE' }) @IsHexColor() color: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '1234' })
  @ValidateIf(present)
  @Matches(/^\d{4}$/, { message: 'Informe os 4 últimos dígitos' })
  lastFourDigits?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @ValidateIf(present)
  @IsUUID('all', { message: 'Conta inválida' })
  paymentAccountId?: string | null;
}

export class UpdateCardDto extends PartialType(CreateCardDto) {}

export class ListCardsQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED', 'ALL'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'], { message: 'Status inválido' })
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
}

export class InvoiceRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-04' })
  @IsOptional()
  @Matches(MONTH_REGEX, { message: 'Mês inválido: use AAAA-MM' })
  from?: string;
  @ApiPropertyOptional({ example: '2026-12' })
  @IsOptional()
  @Matches(MONTH_REGEX, { message: 'Mês inválido: use AAAA-MM' })
  to?: string;
}

export class SpendingQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 24, default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'months inválido' })
  @Min(1, { message: 'months inválido' })
  @Max(24, { message: 'months máximo é 24' })
  months?: number;
}

export class PayInvoiceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('all', { message: 'Conta inválida' }) accountId: string;

  @ApiPropertyOptional({ example: '1200.00', description: 'Padrão: valor em aberto' })
  @ValidateIf(present)
  @IsPositiveMoney()
  amount?: string | null;

  @ApiPropertyOptional({ example: '2026-10-05', description: 'Padrão: hoje (não pode ser futura)' })
  @ValidateIf(present)
  @IsDateOnly()
  date?: string | null;
}
