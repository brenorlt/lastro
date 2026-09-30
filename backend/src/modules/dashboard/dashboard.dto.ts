import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { TransactionDto } from '../transactions/dto/transaction.dto.js';

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-09', description: 'Padrão: mês atual no fuso do usuário' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mês inválido: use AAAA-MM' })
  month?: string;
}

class NetWorthDto {
  @ApiProperty({ example: '35000.00' }) current: string;
  @ApiProperty() assets: string;
  @ApiProperty() liabilities: string;
  @ApiProperty({ description: 'Variação vs. fim do mês 12 meses antes' }) changeAmount12m: string;
  @ApiProperty({ type: Number, nullable: true, description: '% (1 casa); null se a base ≤ 0' })
  change12m: number | null;
}

class FlowDto {
  @ApiProperty() income: string;
  @ApiProperty() expense: string;
  @ApiProperty() net: string;
  @ApiProperty() pendingIncome: string;
  @ApiProperty() pendingExpense: string;
  @ApiProperty() previousIncome: string;
  @ApiProperty() previousExpense: string;
}

class EmergencyFundSummaryDto {
  @ApiProperty() current: string;
  @ApiProperty() target: string;
  @ApiProperty() targetMonths: number;
  @ApiProperty({ type: Number, nullable: true }) coverageMonths: number | null;
  @ApiProperty({ type: Number, nullable: true, description: '% do alvo (máx. 100)' })
  progress: number | null;
}

class CommitmentsDto {
  @ApiProperty({
    description: 'Despesas pendentes em [hoje, hoje+30] + parcelas mensais de dívidas',
  })
  next30Days: string;
  @ApiProperty() pendingCount: number;
  @ApiProperty() overdueCount: number;
  @ApiProperty() overdueAmount: string;
}

class MonthValueDto {
  @ApiProperty({ example: '2026-09' }) month: string;
  @ApiProperty() value: string;
}

class CashflowPointDto {
  @ApiProperty({ example: '2026-09' }) month: string;
  @ApiProperty() income: string;
  @ApiProperty() expense: string;
}

class SpendingItemDto {
  @ApiProperty({ type: String, nullable: true }) categoryId: string | null;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
  @ApiProperty({ type: String, nullable: true }) icon: string | null;
  @ApiProperty() amount: string;
  @ApiProperty({ description: '% (1 casa)' }) share: number;
}

class SeriesDto {
  @ApiProperty({ enum: ['reconstructed', 'snapshots'] }) netWorthMethod:
    'reconstructed' | 'snapshots';
  @ApiProperty({ type: [MonthValueDto] }) netWorth: MonthValueDto[];
  @ApiProperty({ type: [CashflowPointDto] }) cashflow: CashflowPointDto[];
  @ApiProperty({ type: [SpendingItemDto] }) spendingByCategory: SpendingItemDto[];
  @ApiProperty({
    type: [MonthValueDto],
    description: 'Valor da carteira de investimentos ao fim de cada mês',
  })
  investments: MonthValueDto[];
}

class DashboardGoalDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() category: string;
  @ApiProperty() currentAmount: string;
  @ApiProperty() targetAmount: string;
  @ApiProperty({ type: String, nullable: true }) targetDate: string | null;
  @ApiProperty() progress: number;
  @ApiProperty({ type: String, nullable: true }) monthlyContributionNeeded: string | null;
  @ApiProperty() status: string;
}

class InsightDto {
  @ApiProperty({
    enum: [
      'SPENDING_CHANGE',
      'SAVINGS_RATE',
      'EMERGENCY_COVERAGE',
      'TOP_CATEGORY',
      'OVERDUE',
      'INCOME_CHANGE',
    ],
  })
  key: string;
  @ApiProperty({ enum: ['positive', 'neutral', 'warning'] }) tone: string;
  @ApiProperty({ example: 'Sua taxa de poupança está em 35,6%.' }) message: string;
  @ApiProperty() basis: string;
  @ApiProperty({ type: Number, nullable: true }) value: number | null;
}

export class DashboardDto {
  @ApiProperty({ example: '2026-09' }) month: string;
  @ApiProperty({ type: NetWorthDto }) netWorth: NetWorthDto;
  @ApiProperty({ example: { available: '18000.00' } }) cash: { available: string };
  @ApiProperty({ example: { total: '25000.00' } }) investments: { total: string };
  @ApiProperty({
    example: {
      totalUsed: '3200.00',
      totalLimit: '10000.00',
      nextDue: {
        cardId: 'uuid',
        referenceMonth: '2026-10',
        dueDate: '2026-10-10',
        remaining: '1200.00',
      },
    },
    description: 'totalUsed = Σ em aberto das faturas (entra em netWorth.liabilities)',
  })
  cards: {
    totalUsed: string;
    totalLimit: string;
    nextDue: { cardId: string; referenceMonth: string; dueDate: string; remaining: string } | null;
  };
  @ApiProperty({ type: FlowDto }) flow: FlowDto;
  @ApiProperty({ type: EmergencyFundSummaryDto, nullable: true })
  emergencyFund: EmergencyFundSummaryDto | null;
  @ApiProperty({ type: CommitmentsDto }) commitments: CommitmentsDto;
  @ApiProperty({ type: SeriesDto }) series: SeriesDto;
  @ApiProperty({ type: [DashboardGoalDto] }) goals: DashboardGoalDto[];
  @ApiProperty({ type: [TransactionDto] }) upcoming: TransactionDto[];
  @ApiProperty({ type: [TransactionDto] }) recent: TransactionDto[];
  @ApiProperty({ type: [InsightDto] }) insights: InsightDto[];
}
