import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '../../../common/validation/date-only.decorator.js';
import { IsMoneyString } from '../../../common/validation/decorators.js';
import { GoalCategory } from '../../../generated/prisma/enums.js';
import { UserDto } from './user.dto.js';

const GOAL_CATEGORIES = Object.values(GoalCategory);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const present = (_: object, value: unknown) => value !== undefined && value !== null;

export class OnboardingInvestmentsDto {
  @ApiProperty({ example: '25000.00' })
  @IsMoneyString()
  total: string;
}

export class OnboardingDebtsDto {
  @ApiProperty({ example: '8000.00' })
  @IsMoneyString()
  outstanding: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '650.00' })
  @ValidateIf(present)
  @IsMoneyString()
  monthlyPayment?: string | null;
}

export class OnboardingGoalDto {
  @ApiProperty({ enum: GOAL_CATEGORIES })
  @IsIn(GOAL_CATEGORIES, { message: 'Categoria de meta inválida' })
  category: GoalCategory;

  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Viagem ao Japão' })
  @Transform(trim)
  @IsString({ message: 'Informe o nome da meta' })
  @MinLength(1, { message: 'Informe o nome da meta' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres' })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '30000.00' })
  @ValidateIf(present)
  @IsMoneyString()
  targetAmount?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2027-12-31' })
  @ValidateIf(present)
  @IsDateOnly()
  targetDate?: string | null;
}

export class OnboardingDto {
  @ApiProperty({ example: '10000.00' }) @IsMoneyString() monthlyIncome: string;
  @ApiProperty({ example: '6000.00' }) @IsMoneyString() monthlyExpenses: string;

  @ApiProperty({ type: [String], maxItems: 5, description: 'Categorias de DESPESA do usuário' })
  @IsArray({ message: 'Categorias inválidas' })
  @ArrayMaxSize(5, { message: 'Escolha no máximo 5 categorias' })
  @ArrayUnique({ message: 'Categorias repetidas' })
  @IsUUID('all', { each: true, message: 'Categoria inválida' })
  topExpenseCategoryIds: string[];

  @ApiProperty({ example: '18000.00', description: 'Pode ser negativo' })
  @IsMoneyString({ allowNegative: true })
  cashBalance: string;

  @ApiPropertyOptional({ default: 'Conta principal', maxLength: 60 })
  @ValidateIf(present)
  @Transform(trim)
  @IsString({ message: 'Nome da conta inválido' })
  @MinLength(1, { message: 'Informe o nome da conta' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres' })
  mainAccountName?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 60 })
  @ValidateIf(present)
  @Transform(trim)
  @IsString({ message: 'Instituição inválida' })
  @MaxLength(60, { message: 'A instituição deve ter no máximo 60 caracteres' })
  institution?: string | null;

  @ApiPropertyOptional({ type: OnboardingInvestmentsDto, nullable: true })
  @ValidateIf(present)
  @ValidateNested()
  @Type(() => OnboardingInvestmentsDto)
  investments?: OnboardingInvestmentsDto | null;

  @ApiPropertyOptional({ type: OnboardingDebtsDto, nullable: true })
  @ValidateIf(present)
  @ValidateNested()
  @Type(() => OnboardingDebtsDto)
  debts?: OnboardingDebtsDto | null;

  @ApiPropertyOptional({ type: OnboardingGoalDto, nullable: true })
  @ValidateIf(present)
  @ValidateNested()
  @Type(() => OnboardingGoalDto)
  goal?: OnboardingGoalDto | null;

  @ApiProperty({ minimum: 1, maximum: 24, example: 6 })
  @IsInt({ message: 'Meses da reserva inválidos' })
  @Min(1, { message: 'Mínimo de 1 mês' })
  @Max(24, { message: 'Máximo de 24 meses' })
  emergencyMonths: number;
}

export class OnboardingSummaryDto {
  @ApiProperty({ example: '35000.00' }) netWorth: string;
  @ApiProperty({ example: '18000.00' }) cash: string;
  @ApiProperty({ example: '25000.00' }) investments: string;
  @ApiProperty({ example: '8000.00' }) debts: string;
  @ApiProperty({ type: Number, nullable: true, example: 40.0, description: '% com 1 casa' })
  savingsRate: number | null;
  @ApiProperty({ example: '4000.00' }) monthlySurplus: string;
  @ApiProperty({ example: '36000.00' }) emergencyTarget: string;
  @ApiProperty({ type: Number, nullable: true, example: 3.0 }) emergencyCoverageMonths:
    number | null;
  @ApiProperty({ type: String, nullable: true, example: '1250.00' })
  goalMonthlyContribution: string | null;
}

export class OnboardingResultDto {
  @ApiProperty({ type: UserDto }) user: UserDto;
  @ApiProperty({ type: OnboardingSummaryDto }) summary: OnboardingSummaryDto;
}
