import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches, registerDecorator } from 'class-validator';
import { IsMoneyString } from '../../common/validation/decorators.js';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_MESSAGE = { message: 'Mês inválido: use AAAA-MM' };

/** Valor positivo (> 0). */
export function IsPositiveMoney(): PropertyDecorator {
  return (target, propertyName) => {
    IsMoneyString()(target, propertyName);
    registerDecorator({
      name: 'isPositiveMoney',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: 'O valor deve ser maior que zero' },
      validator: { validate: (value: unknown) => typeof value === 'string' && Number(value) > 0 },
    });
  };
}

export class MonthQueryDto {
  @ApiPropertyOptional({ example: '2026-09' })
  @IsOptional()
  @Matches(MONTH_REGEX, MONTH_MESSAGE)
  month?: string;
}

export class BudgetCategoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) parentId: string | null;
}

export class BudgetDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '2026-09' }) month: string;
  @ApiProperty({ type: BudgetCategoryDto }) category: BudgetCategoryDto;
  @ApiProperty({ example: '800.00' }) limitAmount: string;
  @ApiProperty({ example: '640.00' }) spent: string;
  @ApiProperty({ example: '160.00', description: 'Pode ser negativo' }) remaining: string;
  @ApiProperty({ example: 80 }) percent: number;
  @ApiProperty({ enum: ['OK', 'ATTENTION', 'WARNING', 'EXCEEDED'] }) level: string;
  @ApiProperty({ type: [Number], example: [50, 80, 100] }) alertThresholds: number[];
}

export class BudgetsMetaDto {
  @ApiProperty() month: string;
  @ApiProperty() totalLimit: string;
  @ApiProperty() totalSpent: string;
  @ApiProperty() remaining: string;
  @ApiProperty() percent: number;
  @ApiProperty({ description: 'Despesas em categorias sem orçamento' }) unbudgetedSpent: string;
  @ApiProperty() uncategorizedSpent: string;
}

export class BudgetSuggestionDto {
  @ApiProperty({ type: BudgetCategoryDto }) category: BudgetCategoryDto;
  @ApiProperty({ description: 'Média dos últimos 3 meses completos' }) averageSpent: string;
  @ApiProperty() lastMonthSpent: string;
}

export class CreateBudgetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Categoria inválida' })
  categoryId: string;

  @ApiProperty({ example: '2026-09' })
  @Matches(MONTH_REGEX, MONTH_MESSAGE)
  month: string;

  @ApiProperty({ example: '800.00' })
  @IsPositiveMoney()
  limitAmount: string;
}

export class UpdateBudgetDto {
  @ApiProperty({ example: '900.00' })
  @IsPositiveMoney()
  limitAmount: string;
}

export class CopyBudgetsDto {
  @ApiProperty({ example: '2026-08' }) @Matches(MONTH_REGEX, MONTH_MESSAGE) fromMonth: string;
  @ApiProperty({ example: '2026-09' }) @Matches(MONTH_REGEX, MONTH_MESSAGE) toMonth: string;
}

export class CopyResultDto {
  @ApiProperty() created: number;
  @ApiProperty() skipped: number;
}
