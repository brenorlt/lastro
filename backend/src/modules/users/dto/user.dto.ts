import { ApiProperty } from '@nestjs/swagger';

export class NotificationChannelsDto {
  @ApiProperty({ example: true }) inApp: boolean;
  @ApiProperty({ example: true }) email: boolean;
}

export class NotificationPrefsDto {
  @ApiProperty({ type: NotificationChannelsDto }) channels: NotificationChannelsDto;
  @ApiProperty({ example: true }) billsDue: boolean;
  @ApiProperty({ example: true }) invoiceDue: boolean;
  @ApiProperty({ example: true }) budgetAlerts: boolean;
  @ApiProperty({ example: true }) goalReminders: boolean;
  @ApiProperty({ example: true }) emergencyFund: boolean;
  @ApiProperty({ example: false }) newTransactions: boolean;
  @ApiProperty({ example: true }) recurring: boolean;
  @ApiProperty({ example: false }) weeklySummary: boolean;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ type: String, nullable: true, example: '/api/users/avatars/<arquivo>.png' })
  avatarUrl: string | null;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty({ example: 'BRL' }) currency: string;
  @ApiProperty({ example: 'pt-BR' }) locale: string;
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone: string;
  @ApiProperty({ enum: ['SYSTEM', 'LIGHT', 'DARK'] }) theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  @ApiProperty() onboardingCompleted: boolean;
  @ApiProperty({ enum: ['USER', 'ADMIN'] }) role: 'USER' | 'ADMIN';
  @ApiProperty({ type: NotificationPrefsDto }) notificationPrefs: NotificationPrefsDto;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
