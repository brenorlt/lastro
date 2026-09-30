import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou e-mail' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class GrantAccessDto {
  @ApiProperty({
    minimum: 1,
    maximum: 365,
    example: 30,
    description: 'Dias de acesso concedidos a partir de agora',
  })
  @IsInt({ message: 'days deve ser um número inteiro' })
  @Min(1, { message: 'days deve ser no mínimo 1' })
  @Max(365, { message: 'days deve ser no máximo 365' })
  days: number;
}

export class AdminUserListItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ['USER', 'ADMIN'] }) role: 'USER' | 'ADMIN';
  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'BLOCKED', 'CANCELLED'] })
  subscriptionStatus: 'TRIALING' | 'ACTIVE' | 'BLOCKED' | 'CANCELLED';
  @ApiProperty({ format: 'date-time' }) trialEndsAt: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) currentPeriodEnd:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class AdminPaymentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() userName: string;
  @ApiProperty() userEmail: string;
  @ApiProperty({ enum: ['PIX', 'BOLETO', 'CARD'] }) method: 'PIX' | 'BOLETO' | 'CARD';
  @ApiProperty({ enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'] })
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  @ApiProperty({ example: '25.00' }) amount: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) paidAt: string | null;
}

export class AdminUserDetailDto extends AdminUserListItemDto {
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty({ type: [AdminPaymentDto] }) payments: AdminPaymentDto[];
}

export class SignupsByDayDto {
  @ApiProperty({ example: '2026-09-29' }) date: string;
  @ApiProperty() count: number;
}

export class AdminOverviewDto {
  @ApiProperty() totalUsers: number;
  @ApiProperty() trialingCount: number;
  @ApiProperty() activeCount: number;
  @ApiProperty() blockedCount: number;
  @ApiProperty() cancelledCount: number;
  @ApiProperty({ example: '2500.00', description: 'Assinaturas ativas × preço do plano' })
  mrrEstimate: string;
  @ApiProperty() pendingPayments: number;
  @ApiProperty({ type: [SignupsByDayDto] }) signupsByDay: SignupsByDayDto[];
  @ApiProperty({ type: [AdminPaymentDto] }) recentPayments: AdminPaymentDto[];
}
