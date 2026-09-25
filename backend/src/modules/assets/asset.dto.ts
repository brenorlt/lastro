import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsDateOnly } from '../../common/validation/date-only.decorator.js';
import { IsMoneyString } from '../../common/validation/decorators.js';
import { AssetType } from '../../generated/prisma/enums.js';

const TYPES = Object.values(AssetType);
const present = (_: object, v: unknown) => v !== undefined && v !== null;

export class AssetDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: TYPES }) type: AssetType;
  @ApiProperty({ example: '350000.00' }) value: string;
  @ApiProperty({ type: String, nullable: true }) acquiredAt: string | null;
  @ApiProperty({ type: String, nullable: true }) notes: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class CreateAssetDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o nome' })
  @MinLength(1, { message: 'Informe o nome' })
  @MaxLength(80, { message: 'O nome deve ter no máximo 80 caracteres' })
  name: string;

  @ApiProperty({ enum: TYPES }) @IsIn(TYPES, { message: 'Tipo inválido' }) type: AssetType;
  @ApiProperty({ example: '350000.00' }) @IsMoneyString() value: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2020-05-10' })
  @ValidateIf(present)
  @IsDateOnly()
  acquiredAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @ValidateIf(present)
  @IsString({ message: 'Observação inválida' })
  @MaxLength(500, { message: 'A observação deve ter no máximo 500 caracteres' })
  notes?: string | null;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {}
