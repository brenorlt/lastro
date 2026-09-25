import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsHexColor } from '../../common/validation/decorators.js';

export class TagDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'viagem' }) name: string;
  @ApiProperty({ type: String, nullable: true, example: '#0EA5E9' }) color: string | null;
  @ApiProperty() transactionCount: number;
}

export class UpdateTagDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 30 })
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nome inválido' })
  @MinLength(1, { message: 'Informe o nome da tag' })
  @MaxLength(30, { message: 'O nome deve ter no máximo 30 caracteres' })
  name?: string;

  @ApiPropertyOptional({ example: '#0EA5E9' })
  @ValidateIf((_, v) => v !== undefined)
  @IsHexColor()
  color?: string;
}
