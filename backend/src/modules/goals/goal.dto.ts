import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/validation/date-only.decorator.js';
import { IsHexColor, IsIconName, IsMoneyString } from '../../common/validation/decorators.js';
import { GoalCategory, GoalPriority } from '../../generated/prisma/enums.js';
import { IsPositiveMoney } from '../budgets/budget.dto.js';

const CATEGORIES = Object.values(GoalCategory);
const PRIORITIES = Object.values(GoalPriority);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const unlessUndefined = (_: object, v: unknown) => v !== undefined;
const present = (_: object, v: unknown) => v !== undefined && v !== null;

function IsNonZeroMoney(): PropertyDecorator {
  return (target, propertyName) => {
    IsMoneyString({ allowNegative: true })(target, propertyName);
    registerDecorator({
      name: 'isNonZeroMoney',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: 'O valor não pode ser zero' },
      validator: { validate: (value: unknown) => typeof value === 'string' && Number(value) !== 0 },
    });
  };
}

export class GoalDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: CATEGORIES }) category: GoalCategory;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
  @ApiProperty({ enum: PRIORITIES }) priority: GoalPriority;
  @ApiProperty({ enum: ['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED'] }) status: string;
  @ApiProperty() targetAmount: string;
  @ApiProperty() currentAmount: string;
  @ApiProperty() remaining: string;
  @ApiProperty() progress: number;
  @ApiProperty({ type: String, nullable: true }) targetDate: string | null;
  @ApiProperty({ type: Number, nullable: true }) monthsLeft: number | null;
  @ApiProperty({ type: String, nullable: true }) requiredMonthly: string | null;
  @ApiProperty({ type: String, nullable: true }) monthlyContribution: string | null;
  @ApiProperty({ type: String, nullable: true }) projectedCompletionDate: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) onTrack: boolean | null;
  @ApiProperty() contributionsCount: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class ContributionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '500.00', description: 'Negativo = resgate' }) amount: string;
  @ApiProperty({ example: '2026-09-24' }) date: string;
  @ApiProperty({ type: String, nullable: true }) note: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class GoalSeriesPointDto {
  @ApiProperty({ example: '2026-09' }) month: string;
  @ApiProperty() saved: string;
}

export class GoalDetailDto extends GoalDto {
  @ApiProperty({ type: [ContributionDto] }) contributions: ContributionDto[];
  @ApiProperty({ type: [GoalSeriesPointDto] }) series: GoalSeriesPointDto[];
}

export class GoalsMetaDto {
  @ApiProperty() totalTarget: string;
  @ApiProperty() totalSaved: string;
  @ApiProperty() count: number;
}

export class ContributionResultDto {
  @ApiProperty({ type: GoalDto }) goal: GoalDto;
  @ApiProperty({ type: ContributionDto }) contribution: ContributionDto;
}

export class ListGoalsQueryDto {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED', 'ALL'],
    description: 'Padrão: tudo menos ARCHIVED',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED', 'ALL'], { message: 'Status inválido' })
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED' | 'ALL';
}

class GoalFieldsDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2027-12-31',
    description: 'Data futura',
  })
  @ValidateIf(present)
  @IsDateOnly()
  targetDate?: string | null;

  @ApiPropertyOptional({ enum: PRIORITIES, default: 'MEDIUM' })
  @ValidateIf(unlessUndefined)
  @IsIn(PRIORITIES, { message: 'Prioridade inválida' })
  priority?: GoalPriority;

  @ApiPropertyOptional({ type: String, nullable: true, example: '500.00' })
  @ValidateIf(present)
  @IsMoneyString()
  monthlyContribution?: string | null;

  @ApiPropertyOptional({ example: '#0EA5E9' })
  @ValidateIf(unlessUndefined)
  @IsHexColor()
  color?: string;
  @ApiPropertyOptional({ example: 'plane' })
  @ValidateIf(unlessUndefined)
  @IsIconName()
  icon?: string;
}

export class CreateGoalDto extends GoalFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @Transform(trim)
  @IsString({ message: 'Informe o nome da meta' })
  @MinLength(1, { message: 'Informe o nome da meta' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres' })
  name: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES, { message: 'Categoria inválida' })
  category: GoalCategory;

  @ApiProperty({ example: '30000.00' }) @IsPositiveMoney() targetAmount: string;

  @ApiPropertyOptional({
    example: '1000.00',
    description: 'Vira um aporte inicial ("Valor inicial")',
  })
  @ValidateIf(present)
  @IsMoneyString()
  currentAmount?: string | null;
}

export class UpdateGoalDto extends GoalFieldsDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @ValidateIf(unlessUndefined)
  @Transform(trim)
  @IsString({ message: 'Informe o nome da meta' })
  @MinLength(1, { message: 'Informe o nome da meta' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres' })
  name?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @ValidateIf(unlessUndefined)
  @IsIn(CATEGORIES, { message: 'Categoria inválida' })
  category?: GoalCategory;

  @ApiPropertyOptional({ example: '30000.00' })
  @ValidateIf(unlessUndefined)
  @IsPositiveMoney()
  targetAmount?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'] })
  @ValidateIf(unlessUndefined)
  @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED'], { message: 'Status inválido' })
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

export class CreateContributionDto {
  @ApiProperty({ example: '500.00', description: 'Negativo = resgate' })
  @IsNonZeroMoney()
  amount: string;
  @ApiProperty({ example: '2026-09-24', description: 'Até hoje' }) @IsDateOnly() date: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @ValidateIf(present)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(255, { message: 'A observação deve ter no máximo 255 caracteres' })
  note?: string | null;
}
