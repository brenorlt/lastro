import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength, IsOptional } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { SearchService } from './search.service.js';

export class SearchQueryDto {
  @ApiProperty({ minLength: 2, example: 'mercado' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o termo de busca' })
  @MinLength(2, { message: 'Digite pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'Busca muito longa' })
  q: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit inválido' })
  @Min(1, { message: 'limit inválido' })
  @Max(20, { message: 'limit máximo é 20' })
  limit?: number;
}

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca global (sem diferenciar acentos)',
    description: 'cards, goals e investments são reservados para fases futuras (sempre []).',
  })
  @ApiOkResponse({
    description:
      '{ success, data: { transactions, accounts, categories, cards, goals, investments } }',
  })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  find(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    return this.search.search(user.id, query.q, query.limit ?? 5);
  }
}
