import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsHexColor, IsIconName } from '../../../common/validation/decorators.js';
import { CategoryType } from '../../../generated/prisma/enums.js';

const CATEGORY_TYPES = Object.values(CategoryType);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const unlessUndefined = (_: object, value: unknown) => value !== undefined;

export class CategoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Alimentação' }) name: string;
  @ApiProperty({ enum: CATEGORY_TYPES }) type: CategoryType;
  @ApiProperty({ type: String, nullable: true, example: 'utensils' }) icon: string | null;
  @ApiProperty({ type: String, nullable: true, example: '#EF4444' }) color: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) parentId: string | null;
  @ApiProperty() isDefault: boolean;
  @ApiProperty({ description: 'Lançamentos não excluídos desta categoria (sem somar filhos)' })
  transactionCount: number;
  @ApiPropertyOptional({
    type: () => [CategoryDto],
    description: 'Presente apenas nos itens de primeiro nível',
  })
  children?: CategoryDto[];
}

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ enum: CATEGORY_TYPES })
  @IsOptional()
  @IsIn(CATEGORY_TYPES, { message: 'Tipo inválido' })
  type?: CategoryType;
}

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 40 })
  @Transform(trim)
  @IsString({ message: 'Informe o nome da categoria' })
  @MinLength(1, { message: 'Informe o nome da categoria' })
  @MaxLength(40, { message: 'O nome deve ter no máximo 40 caracteres' })
  name: string;

  @ApiProperty({ enum: CATEGORY_TYPES })
  @IsIn(CATEGORY_TYPES, { message: 'Tipo inválido' })
  type: CategoryType;

  @ApiProperty({ example: 'utensils' })
  @IsIconName()
  icon: string;

  @ApiProperty({ example: '#EF4444' })
  @IsHexColor()
  color: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID('all', { message: 'Categoria pai inválida' })
  parentId?: string | null;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 40 })
  @ValidateIf(unlessUndefined)
  @Transform(trim)
  @IsString({ message: 'Informe o nome da categoria' })
  @MinLength(1, { message: 'Informe o nome da categoria' })
  @MaxLength(40, { message: 'O nome deve ter no máximo 40 caracteres' })
  name?: string;

  @ApiPropertyOptional({ example: 'utensils' })
  @ValidateIf(unlessUndefined)
  @IsIconName()
  icon?: string;

  @ApiPropertyOptional({ example: '#EF4444' })
  @ValidateIf(unlessUndefined)
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null move para o primeiro nível; omitido mantém',
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsUUID('all', { message: 'Categoria pai inválida' })
  parentId?: string | null;
}

export class DeleteCategoryQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Categoria (mesmo tipo) que recebe lançamentos e recorrências',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Categoria de destino inválida' })
  reassignTo?: string;
}
