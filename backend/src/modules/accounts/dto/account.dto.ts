import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsHexColor, IsIconName, IsMoneyString } from '../../../common/validation/decorators.js';
import { AccountStatus, AccountType } from '../../../generated/prisma/enums.js';

const ACCOUNT_TYPES = Object.values(AccountType);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AccountDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Nubank' }) name: string;
  @ApiProperty({ type: String, nullable: true }) institution: string | null;
  @ApiProperty({ enum: ACCOUNT_TYPES }) type: AccountType;
  @ApiProperty({ example: '1000.00' }) initialBalance: string;
  @ApiProperty({ example: '1520.40' }) currentBalance: string;
  @ApiProperty({ type: String, nullable: true, example: '#8B5CF6' }) color: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'wallet' }) icon: string | null;
  @ApiProperty({ enum: Object.values(AccountStatus) }) status: AccountStatus;
  @ApiProperty() includeInNetWorth: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class AccountStatsDto {
  @ApiProperty({ description: 'Lançamentos (origem ou destino)' }) transactionCount: number;
  @ApiProperty({ type: String, nullable: true, example: '2026-09-20' })
  lastTransactionDate: string | null;
}

export class AccountDetailDto extends AccountDto {
  @ApiProperty({ type: AccountStatsDto }) stats: AccountStatsDto;
}

export class AccountsMetaDto {
  @ApiProperty({
    example: '12450.90',
    description: 'Soma de currentBalance das contas ATIVAS com includeInNetWorth',
  })
  totalBalance: string;
  @ApiProperty({ description: 'Quantidade de itens retornados em data' }) count: number;
  @ApiProperty({
    example: { CHECKING: '2450.90', INVESTMENT: '10000.00' },
    description: 'Mesma base de totalBalance, agrupada por tipo (só tipos presentes)',
  })
  byType: Record<string, string>;
}

export class CreateAccountDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @Transform(trim)
  @IsString({ message: 'Informe o nome da conta' })
  @MinLength(1, { message: 'Informe o nome da conta' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres' })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 60 })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString({ message: 'Instituição inválida' })
  @MaxLength(60, { message: 'A instituição deve ter no máximo 60 caracteres' })
  institution?: string | null;

  @ApiProperty({ enum: ACCOUNT_TYPES })
  @IsIn(ACCOUNT_TYPES, { message: 'Tipo de conta inválido' })
  type: AccountType;

  @ApiProperty({ example: '1000.00', description: 'Pode ser negativo' })
  @IsMoneyString({ allowNegative: true })
  initialBalance: string;

  @ApiProperty({ example: '#8B5CF6' })
  @IsHexColor()
  color: string;

  @ApiProperty({ example: 'wallet' })
  @IsIconName()
  icon: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Valor inválido' })
  includeInNetWorth?: boolean;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED', 'ALL'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'], { message: 'Status inválido' })
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
}
