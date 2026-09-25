import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
} from 'class-validator';
import { IsMoneyString } from '../../common/validation/decorators.js';
import { IsPositiveMoney } from '../budgets/budget.dto.js';

const present = (_: object, v: unknown) => v !== undefined && v !== null;

export class LinkedAccountDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty() currentBalance: string;
}

export class EmergencySuggestionsDto {
  @ApiProperty({ type: String, nullable: true }) averageMonthlyExpense: string | null;
  @ApiProperty({ type: String, nullable: true }) averageMonthlySurplus: string | null;
}

export class EmergencyFundDto {
  @ApiProperty() monthlyCost: string;
  @ApiProperty() targetMonths: number;
  @ApiProperty() targetAmount: string;
  @ApiProperty() customTarget: boolean;
  @ApiProperty({ enum: ['LINKED', 'MANUAL'] }) mode: 'LINKED' | 'MANUAL';
  @ApiProperty({ type: LinkedAccountDto, nullable: true }) linkedAccount: LinkedAccountDto | null;
  @ApiProperty() currentAmount: string;
  @ApiProperty() remaining: string;
  @ApiProperty({ type: Number, nullable: true }) progress: number | null;
  @ApiProperty({ type: Number, nullable: true }) coverageMonths: number | null;
  @ApiProperty({ type: String, nullable: true }) monthlyContribution: string | null;
  @ApiProperty({ type: Number, nullable: true }) monthsToTarget: number | null;
  @ApiProperty({ type: String, nullable: true }) projectedDate: string | null;
  @ApiProperty({ type: EmergencySuggestionsDto }) suggestions: EmergencySuggestionsDto;
}

export class PutEmergencyFundDto {
  @ApiProperty({ example: '6000.00' }) @IsPositiveMoney() monthlyCost: string;

  @ApiProperty({ minimum: 1, maximum: 24, example: 6 })
  @IsInt({ message: 'Meses inválidos' })
  @Min(1, { message: 'Mínimo de 1 mês' })
  @Max(24, { message: 'Máximo de 24 meses' })
  targetMonths: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Omitido/null = monthlyCost × targetMonths',
  })
  @ValidateIf(present)
  @IsPositiveMoney()
  targetAmount?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null = modo MANUAL',
  })
  @ValidateIf(present)
  @IsUUID('all', { message: 'Conta inválida' })
  linkedAccountId?: string | null;

  @ApiPropertyOptional({ example: '5000.00', description: 'Só no modo MANUAL' })
  @ValidateIf(present)
  @IsMoneyString()
  currentAmount?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '800.00' })
  @ValidateIf(present)
  @IsMoneyString()
  monthlyContribution?: string | null;
}

export class AdjustEmergencyFundDto {
  @ApiProperty({ example: '-200.00', description: 'Positivo = guardar, negativo = retirar' })
  amount: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @ValidateIf(present)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(255, { message: 'A observação deve ter no máximo 255 caracteres' })
  note?: string | null;
}

// Valor ± diferente de zero.
registerDecorator({
  name: 'isNonZeroSignedMoney',
  target: AdjustEmergencyFundDto,
  propertyName: 'amount',
  options: { message: 'Valor inválido: use até 2 casas decimais e diferente de zero' },
  validator: {
    validate: (value: unknown) =>
      typeof value === 'string' && /^-?\d{1,15}(\.\d{1,2})?$/.test(value) && Number(value) !== 0,
  },
});
