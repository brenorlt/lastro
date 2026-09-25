import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { IsMoneyString } from '../../common/validation/decorators.js';

const pct = { maxDecimalPlaces: 2 };

export const DEFAULT_ASSUMPTIONS = {
  horizonYears: 10,
  monthlyContribution: null as string | null,
  annualReturn: 8,
  incomeGrowth: 4,
  expenseGrowth: 4,
  inflation: 4,
};

export class PlanningAssumptionsDto {
  @ApiProperty({ minimum: 1, maximum: 40, example: 10 })
  @IsInt({ message: 'Horizonte inválido' })
  @Min(1, { message: 'Horizonte mínimo de 1 ano' })
  @Max(40, { message: 'Horizonte máximo de 40 anos' })
  horizonYears: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1500.00',
    description: 'null = usar a sobra mensal média',
  })
  @ValidateIf((_, v) => v !== null)
  @IsMoneyString()
  monthlyContribution: string | null;

  @ApiProperty({ minimum: -10, maximum: 30, example: 8, description: '% a.a.' })
  @IsNumber(pct, { message: 'Retorno inválido' })
  @Min(-10, { message: 'Retorno mínimo de -10%' })
  @Max(30, { message: 'Retorno máximo de 30%' })
  annualReturn: number;

  @ApiProperty({ minimum: -10, maximum: 20, example: 4 })
  @IsNumber(pct, { message: 'Crescimento inválido' })
  @Min(-10, { message: 'Mínimo de -10%' })
  @Max(20, { message: 'Máximo de 20%' })
  incomeGrowth: number;

  @ApiProperty({ minimum: -10, maximum: 20, example: 4 })
  @IsNumber(pct, { message: 'Crescimento inválido' })
  @Min(-10, { message: 'Mínimo de -10%' })
  @Max(20, { message: 'Máximo de 20%' })
  expenseGrowth: number;

  @ApiProperty({ minimum: -10, maximum: 20, example: 4 })
  @IsNumber(pct, { message: 'Inflação inválida' })
  @Min(-10, { message: 'Mínimo de -10%' })
  @Max(20, { message: 'Máximo de 20%' })
  inflation: number;
}

export class PlanningBaselineDto {
  @ApiProperty() netWorth: string;
  @ApiProperty({
    description: 'Total investido (valor atual dos investimentos + saldo em corretora)',
  })
  investable: string;
  @ApiProperty() cash: string;
  @ApiProperty({ nullable: true, example: { current: '9000.00', target: '36000.00' } })
  emergencyFund: { current: string; target: string } | null;
  @ApiProperty({ type: String, nullable: true }) averageMonthlyIncome: string | null;
  @ApiProperty({ type: String, nullable: true }) averageMonthlyExpense: string | null;
  @ApiProperty({ type: String, nullable: true }) averageMonthlySurplus: string | null;
  @ApiProperty() monthlyDebtPayments: string;
  @ApiProperty({
    example: [
      {
        id: 'uuid',
        name: 'Japão',
        targetAmount: '30000.00',
        currentAmount: '0.00',
        targetDate: '2027-12-31',
      },
    ],
  })
  goals: {
    id: string;
    name: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: string | null;
  }[];
  @ApiProperty({ enum: ['ACTUAL', 'ONBOARDING', 'NONE'] }) dataQuality:
    'ACTUAL' | 'ONBOARDING' | 'NONE';
}
