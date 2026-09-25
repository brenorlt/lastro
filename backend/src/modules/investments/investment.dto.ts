import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { IsMoneyString } from '../../common/validation/decorators.js';
import {
  InvestmentLiquidity,
  InvestmentTransactionType,
  InvestmentType,
} from '../../generated/prisma/enums.js';
import { IsPositiveMoney } from '../budgets/budget.dto.js';

const TYPES = Object.values(InvestmentType);
const LIQUIDITY = Object.values(InvestmentLiquidity);
const TX_TYPES = Object.values(InvestmentTransactionType);
const QUANTITY_REGEX = /^\d{1,16}(\.\d{1,8})?$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const present = (_: object, v: unknown) => v !== undefined && v !== null;
const unlessUndefined = (_: object, v: unknown) => v !== undefined;
const QTY = { message: 'Quantidade inválida: número positivo com até 8 casas (ex.: "10.5")' };
const PRICE = { message: 'Preço inválido: número com até 8 casas (ex.: "32.15")' };

export class InvestmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) ticker: string | null;
  @ApiProperty({ type: String, nullable: true }) institution: string | null;
  @ApiProperty({ enum: TYPES }) type: InvestmentType;
  @ApiProperty({ type: String, nullable: true, example: '10.00000000' }) quantity: string | null;
  @ApiProperty({ type: String, nullable: true, example: '32.15000000' }) averagePrice:
    string | null;
  @ApiProperty({ description: 'Custo (base)' }) investedAmount: string;
  @ApiProperty() currentValue: string;
  @ApiProperty({ description: 'Σ dividendos + juros − taxas' }) income: string;
  @ApiProperty({ description: 'Ganho realizado em vendas' }) realizedGain: string;
  @ApiProperty({ description: 'atual − investido + rendimentos + ganho realizado' }) profit: string;
  @ApiProperty({ type: Number, nullable: true }) profitPercent: number | null;
  @ApiProperty({ type: String, nullable: true }) appliedAt: string | null;
  @ApiProperty({ type: String, nullable: true }) maturityDate: string | null;
  @ApiProperty({ enum: LIQUIDITY }) liquidity: InvestmentLiquidity;
  @ApiProperty({ type: Number, nullable: true }) liquidityDays: number | null;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ description: '% do valor atual total da carteira' }) allocationPercent: number;
  @ApiProperty({ type: String, nullable: true }) lastValuationAt: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class InvestmentTxDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: TX_TYPES }) type: InvestmentTransactionType;
  @ApiProperty({ type: String, nullable: true }) quantity: string | null;
  @ApiProperty({ type: String, nullable: true }) price: string | null;
  @ApiProperty() amount: string;
  @ApiProperty() date: string;
  @ApiProperty({ type: String, nullable: true }) note: string | null;
  @ApiProperty({ nullable: true, example: { id: 'uuid', name: 'Corrente' } }) account: {
    id: string;
    name: string;
  } | null;
}

export class InvestmentSeriesPointDto {
  @ApiProperty({ example: '2026-09' }) month: string;
  @ApiProperty() value: string;
  @ApiProperty() invested: string;
}

export class PortfolioSeriesPointDto extends InvestmentSeriesPointDto {
  @ApiProperty({ description: 'Aportes líquidos (compras − vendas) no mês' }) contributions: string;
}

export class InvestmentDetailDto extends InvestmentDto {
  @ApiProperty({ type: [InvestmentTxDto] }) transactions: InvestmentTxDto[];
  @ApiProperty({ type: [InvestmentSeriesPointDto] }) series: InvestmentSeriesPointDto[];
}

export class ListInvestmentsQueryDto {
  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES, { message: 'Tipo inválido' })
  type?: InvestmentType;
}

export class SeriesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 60, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'months inválido' })
  @Min(1, { message: 'months inválido' })
  @Max(60, { message: 'months máximo é 60' })
  months?: number;
}

class InvestmentFieldsDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 12, example: 'PETR4' })
  @ValidateIf(present)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Ticker inválido' })
  @MaxLength(12, { message: 'Ticker muito longo' })
  ticker?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 80 })
  @ValidateIf(present)
  @Transform(trim)
  @IsString({ message: 'Instituição inválida' })
  @MaxLength(80, { message: 'A instituição deve ter no máximo 80 caracteres' })
  institution?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2028-01-01' })
  @ValidateIf(present)
  @IsDateOnly()
  maturityDate?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 30 })
  @ValidateIf(present)
  @IsInt({ message: 'Dias de liquidez inválidos' })
  @Min(0, { message: 'Dias de liquidez inválidos' })
  @Max(3650, { message: 'Dias de liquidez inválidos' })
  liquidityDays?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @ValidateIf(present)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(500, { message: 'A observação deve ter no máximo 500 caracteres' })
  notes?: string | null;
}

export class CreateInvestmentDto extends InvestmentFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString({ message: 'Informe o nome' })
  @MinLength(1, { message: 'Informe o nome' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name: string;

  @ApiProperty({ enum: TYPES }) @IsIn(TYPES, { message: 'Tipo inválido' }) type: InvestmentType;

  @ApiPropertyOptional({ example: '10', description: 'Cotas (até 8 casas)' })
  @ValidateIf(present)
  @Matches(QUANTITY_REGEX, QTY)
  quantity?: string | null;

  @ApiPropertyOptional({ example: '32.15' })
  @ValidateIf(present)
  @Matches(QUANTITY_REGEX, PRICE)
  averagePrice?: string | null;

  @ApiPropertyOptional({
    example: '321.50',
    description: 'Obrigatório se não houver quantidade × preço',
  })
  @ValidateIf(present)
  @IsPositiveMoney()
  investedAmount?: string | null;

  @ApiPropertyOptional({ example: '350.00', description: 'Padrão: valor investido' })
  @ValidateIf(present)
  @IsMoneyString()
  currentValue?: string | null;

  @ApiProperty({ example: '2026-09-01', description: 'Até hoje' }) @IsDateOnly() appliedAt: string;

  @ApiProperty({ enum: LIQUIDITY })
  @IsIn(LIQUIDITY, { message: 'Liquidez inválida' })
  liquidity: InvestmentLiquidity;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Conta de onde sai o dinheiro',
  })
  @ValidateIf(present)
  @IsUUID('all', { message: 'Conta inválida' })
  fundingAccountId?: string | null;
}

export class UpdateInvestmentDto extends InvestmentFieldsDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @ValidateIf(unlessUndefined)
  @Transform(trim)
  @IsString({ message: 'Informe o nome' })
  @MinLength(1, { message: 'Informe o nome' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name?: string;

  @ApiPropertyOptional({ enum: TYPES })
  @ValidateIf(unlessUndefined)
  @IsIn(TYPES, { message: 'Tipo inválido' })
  type?: InvestmentType;

  @ApiPropertyOptional({ enum: LIQUIDITY })
  @ValidateIf(unlessUndefined)
  @IsIn(LIQUIDITY, { message: 'Liquidez inválida' })
  liquidity?: InvestmentLiquidity;
}

export class CreateInvestmentTxDto {
  @ApiProperty({ enum: TX_TYPES })
  @IsIn(TX_TYPES, { message: 'Tipo inválido' })
  type: InvestmentTransactionType;

  @ApiProperty({ example: '500.00', description: 'VALUATION: novo valor total atual' })
  @IsPositiveMoney()
  amount: string;

  @ApiPropertyOptional({ example: '10' })
  @ValidateIf(present)
  @Matches(QUANTITY_REGEX, QTY)
  quantity?: string | null;
  @ApiPropertyOptional({ example: '50.00' })
  @ValidateIf(present)
  @Matches(QUANTITY_REGEX, PRICE)
  price?: string | null;
  @ApiProperty({ example: '2026-09-24', description: 'Até hoje' }) @IsDateOnly() date: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @ValidateIf(present)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(255, { message: 'A observação deve ter no máximo 255 caracteres' })
  note?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Movimenta o caixa desta conta',
  })
  @ValidateIf(present)
  @IsUUID('all', { message: 'Conta inválida' })
  accountId?: string | null;
}
