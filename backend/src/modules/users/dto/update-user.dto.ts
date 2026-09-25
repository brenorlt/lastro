import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR'] as const;
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;
export const THEMES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
const TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));
TIMEZONES.add('UTC');

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Campo opcional mas não anulável: `undefined` é ignorado, `null` é validado (e falha). */
const unlessUndefined = (_: object, value: unknown) => value !== undefined;
const message = (text: string) => ({ message: text });

export class NotificationChannelsPatchDto {
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  inApp?: boolean;

  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  email?: boolean;
}

export class NotificationPrefsPatchDto {
  @ApiPropertyOptional({ type: NotificationChannelsPatchDto })
  @ValidateIf(unlessUndefined)
  @IsObject(message('Canais inválidos'))
  @ValidateNested()
  @Type(() => NotificationChannelsPatchDto)
  channels?: NotificationChannelsPatchDto;

  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  billsDue?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  invoiceDue?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  budgetAlerts?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  goalReminders?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  emergencyFund?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  newTransactions?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  recurring?: boolean;
  @ApiPropertyOptional()
  @ValidateIf(unlessUndefined)
  @IsBoolean(message('Valor inválido'))
  weeklySummary?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 80 })
  @ValidateIf(unlessUndefined)
  @Transform(trim)
  @IsString(message('Informe seu nome'))
  @MinLength(2, message('O nome deve ter pelo menos 2 caracteres'))
  @MaxLength(80, message('O nome deve ter no máximo 80 caracteres'))
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '+55 11 91234-5678' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString(message('Telefone inválido'))
  @Matches(/^\+?[0-9 ()-]{8,20}$/, message('Telefone inválido'))
  phone?: string | null;

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCIES })
  @ValidateIf(unlessUndefined)
  @IsIn(SUPPORTED_CURRENCIES, message('Moeda não suportada'))
  currency?: (typeof SUPPORTED_CURRENCIES)[number];

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @ValidateIf(unlessUndefined)
  @IsIn(SUPPORTED_LOCALES, message('Idioma não suportado'))
  locale?: (typeof SUPPORTED_LOCALES)[number];

  @ApiPropertyOptional({ example: 'America/Sao_Paulo', description: 'Fuso IANA' })
  @ValidateIf(unlessUndefined)
  @IsString(message('Fuso horário inválido'))
  @IsIn([...TIMEZONES], message('Fuso horário inválido'))
  timezone?: string;

  @ApiPropertyOptional({ enum: THEMES })
  @ValidateIf(unlessUndefined)
  @IsIn(THEMES, message('Tema inválido'))
  theme?: (typeof THEMES)[number];

  @ApiPropertyOptional({
    type: NotificationPrefsPatchDto,
    description: 'Patch parcial (merge profundo, inclusive `channels`)',
  })
  @ValidateIf(unlessUndefined)
  @IsObject(message('Preferências inválidas'))
  @ValidateNested()
  @Type(() => NotificationPrefsPatchDto)
  notificationPrefs?: NotificationPrefsPatchDto;
}

export class DeleteMeDto {
  @ApiProperty({ description: 'Senha atual' })
  @IsString(message('Informe sua senha'))
  @IsNotEmpty(message('Informe sua senha'))
  @MaxLength(128, message('Senha incorreta'))
  password: string;

  @ApiProperty({ example: 'EXCLUIR', description: 'Digite exatamente EXCLUIR' })
  @Equals('EXCLUIR', message('Digite EXCLUIR para confirmar'))
  confirmation: 'EXCLUIR';
}
