import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
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
import { LiabilityType } from '../../generated/prisma/enums.js';
import { IsPositiveMoney } from '../budgets/budget.dto.js';

const TYPES = Object.values(LiabilityType);
const present = (_: object, v: unknown) => v !== undefined && v !== null;

export class LiabilityPaymentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() amount: string;
  @ApiProperty() date: string;
  @ApiProperty({ nullable: true, example: { id: 'uuid', name: 'Corrente' } }) account: {
    id: string;
    name: string;
  } | null;
  @ApiProperty({ type: String, nullable: true }) transactionId: string | null;
}

export class LiabilityDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: TYPES }) type: LiabilityType;
  @ApiProperty() principal: string;
  @ApiProperty() outstandingBalance: string;
  @ApiProperty({ type: String, nullable: true, description: '% a.a.', example: '12.5000' })
  interestRate: string | null;
  @ApiProperty({ type: String, nullable: true }) monthlyPayment: string | null;
  @ApiProperty({ type: Number, nullable: true }) dueDay: number | null;
  @ApiProperty({ type: String, nullable: true }) startDate: string | null;
  @ApiProperty({ type: String, nullable: true }) endDate: string | null;
  @ApiProperty() paidPercent: number;
  @ApiProperty({ type: Number, nullable: true }) remainingInstallments: number | null;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
}

export class LiabilityDetailDto extends LiabilityDto {
  @ApiProperty({ type: [LiabilityPaymentDto] }) payments: LiabilityPaymentDto[];
}

export class CreateLiabilityDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o nome' })
  @MinLength(1, { message: 'Informe o nome' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name: string;

  @ApiProperty({ enum: TYPES }) @IsIn(TYPES, { message: 'Tipo inválido' }) type: LiabilityType;
  @ApiProperty({ example: '20000.00' }) @IsPositiveMoney() principal: string;

  @ApiPropertyOptional({ example: '15000.00', description: 'Padrão: principal' })
  @ValidateIf(present)
  @IsMoneyString()
  outstandingBalance?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12.5',
    description: '% a.a. (0–1000)',
  })
  @ValidateIf(present)
  @Matches(/^\d{1,4}(\.\d{1,4})?$/, { message: 'Taxa inválida: use até 4 casas (ex.: "12.5")' })
  interestRate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '850.00' })
  @ValidateIf(present)
  @IsMoneyString()
  monthlyPayment?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: 31 })
  @ValidateIf(present)
  @IsInt({ message: 'Dia inválido' })
  @Min(1, { message: 'Dia inválido' })
  @Max(31, { message: 'Dia inválido' })
  dueDay?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsDateOnly()
  startDate?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(present)
  @IsDateOnly()
  endDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @ValidateIf(present)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(500, { message: 'A observação deve ter no máximo 500 caracteres' })
  notes?: string | null;
}

export class UpdateLiabilityDto extends PartialType(CreateLiabilityDto) {}

export class PayLiabilityDto {
  @ApiProperty({ example: '850.00' }) @IsPositiveMoney() amount: string;
  @ApiProperty({ example: '2026-09-24', description: 'Até hoje' }) @IsDateOnly() date: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Debita a conta (TRANSFER neutra)',
  })
  @ValidateIf(present)
  @IsUUID('all', { message: 'Conta inválida' })
  accountId?: string | null;
}
