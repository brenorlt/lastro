import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '../../../common/validation/date-only.decorator.js';
import { IsMoneyString } from '../../../common/validation/decorators.js';

/** Um extrato de vários meses cabe folgado; acima disso, peça para dividir o período. */
export const MAX_IMPORT_ROWS = 1000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const STATUSES = ['NEW', 'DUPLICATE', 'IMPORTED', 'UNSUPPORTED'] as const;
const TYPES = ['INCOME', 'EXPENSE'] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Destino do extrato: exatamente um entre conta e cartão (validado no service). */
class ImportTargetDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  creditCardId?: string;
}

/** Campos do multipart que acompanham o arquivo. */
export class PreviewImportDto extends ImportTargetDto {
  @ApiPropertyOptional({ description: 'Inverte os sinais em relação à detecção automática' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  invertSigns?: boolean;
}

export class CommitImportRowDto {
  @ApiProperty({ description: 'Vindo da prévia (sha256 hex)' })
  @Matches(/^[a-f0-9]{64}$/, { message: 'externalId inválido' })
  externalId: string;

  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type: (typeof TYPES)[number];

  @ApiProperty({ example: '42.90' })
  @IsMoneyString()
  @Matches(/^(?!0+(\.0+)?$)\d{1,12}(\.\d{1,2})?$/, {
    message: 'O valor deve ser maior que zero e no máximo 999999999999.99',
  })
  amount: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: '2026-09-15' })
  @IsDateOnly()
  date: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

export class CommitImportDto extends ImportTargetDto {
  @ApiProperty({ type: [CommitImportRowDto], maxItems: MAX_IMPORT_ROWS })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um lançamento' })
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => CommitImportRowDto)
  rows: CommitImportRowDto[];
}

// ───────────────────────── Respostas ─────────────────────────

export class ImportTargetInfoDto {
  @ApiProperty({ enum: ['ACCOUNT', 'CARD'] }) kind: 'ACCOUNT' | 'CARD';
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true, description: 'Saldo atual (só conta)' })
  currentBalance: string | null;
}

export class StatementBalanceDto {
  @ApiProperty({ example: '1520.40' }) amount: string;
  @ApiProperty({ example: '2026-09-30' }) date: string;
}

export class ImportPreviewRowDto {
  @ApiProperty() externalId: string;
  @ApiProperty({ example: '2026-09-15' }) date: string;
  @ApiProperty() description: string;
  @ApiProperty({ example: '42.90' }) amount: string;
  @ApiProperty({ enum: TYPES }) type: (typeof TYPES)[number];
  @ApiProperty({
    enum: STATUSES,
    description:
      'NEW: pronto para importar · DUPLICATE: há um lançamento igual (±3 dias) · IMPORTED: já importado · UNSUPPORTED: não importável',
  })
  status: (typeof STATUSES)[number];
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Categoria sugerida' })
  categoryId: string | null;
}

export class ImportPreviewDto {
  @ApiProperty({ enum: ['OFX', 'CSV'] }) format: 'OFX' | 'CSV';
  @ApiProperty({ enum: ['BANK', 'CARD'], nullable: true, type: String })
  statementKind: 'BANK' | 'CARD' | null;
  @ApiProperty({ type: ImportTargetInfoDto }) target: ImportTargetInfoDto;
  @ApiProperty({ type: StatementBalanceDto, nullable: true })
  statementBalance: StatementBalanceDto | null;
  @ApiProperty({ description: 'Sinais efetivamente invertidos (detecção automática ⊕ pedido)' })
  signsInverted: boolean;
  @ApiProperty({ type: [ImportPreviewRowDto] }) rows: ImportPreviewRowDto[];
}

export class ImportResultDto {
  @ApiProperty() created: number;
  @ApiProperty({ description: 'Linhas ignoradas por já estarem importadas' }) skipped: number;
}
