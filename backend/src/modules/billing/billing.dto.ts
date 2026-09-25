import { ApiProperty } from '@nestjs/swagger';

export class BillingStatusDto {
  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'BLOCKED', 'CANCELLED'] })
  status: 'TRIALING' | 'ACTIVE' | 'BLOCKED' | 'CANCELLED';

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  trialEndsAt: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  currentPeriodEnd: string | null;

  @ApiProperty()
  cancelAtPeriodEnd: boolean;

  @ApiProperty()
  hasRecurringSubscription: boolean;

  @ApiProperty({ example: '25.00' })
  planPrice: string;
}

export class PixCheckoutDto {
  @ApiProperty({ example: 'pix_char_z2rSk6042t1mCKgGgeBpJe1u' })
  id: string;

  @ApiProperty({ description: 'Código copia-e-cola do Pix' })
  brCode: string;

  @ApiProperty({ description: 'QR Code em base64 (data:image/png;base64,...)' })
  brCodeBase64: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class HostedCheckoutDto {
  @ApiProperty({
    description: 'URL do checkout hospedado da AbacatePay para redirecionar o usuário',
  })
  url: string;
}
