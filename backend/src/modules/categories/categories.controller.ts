import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { CategoriesService } from './categories.service.js';
import { CategorySuggesterService } from './category-suggester.service.js';
import {
  CategoryDto,
  CategorySuggestionDto,
  CreateCategoryDto,
  DeleteCategoryQueryDto,
  ListCategoriesQueryDto,
  SuggestCategoryQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto.js';

const CategoryId = () => Param('id', new ParseIdPipe(ErrorCode.CATEGORY_NOT_FOUND));

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly suggester: CategorySuggesterService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Árvore de categorias (2 níveis, ordem alfabética pt-BR)' })
  @ApiEnvelope(CategoryDto, { isArray: true })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryDto[]> {
    return this.categories.tree(user.id, query.type);
  }

  @Get('suggest')
  @ApiOperation({
    summary: 'Categoria que seria aplicada automaticamente a um lançamento com esta descrição',
  })
  @ApiEnvelope(CategorySuggestionDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  async suggest(
    @CurrentUser() user: AuthUser,
    @Query() query: SuggestCategoryQueryDto,
  ): Promise<CategorySuggestionDto> {
    return { category: await this.suggester.suggestRef(user.id, query.description, query.type) };
  }

  @Post()
  @ApiOperation({ summary: 'Cria categoria ou subcategoria (pai de 1º nível e mesmo tipo)' })
  @ApiEnvelope(CategoryDto, { status: 201 })
  @ApiErrors(
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.INVALID_PARENT_CATEGORY,
    ErrorCode.CATEGORY_ALREADY_EXISTS,
  )
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(user.id, dto);
  }

  @Post('restore-defaults')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recria categorias padrão ausentes e devolve a árvore' })
  @ApiEnvelope(CategoryDto, { isArray: true })
  restoreDefaults(@CurrentUser() user: AuthUser): Promise<CategoryDto[]> {
    return this.categories.restoreDefaults(user.id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Edita nome/ícone/cor ou move (parentId null = raiz). Tipo é imutável' })
  @ApiEnvelope(CategoryDto)
  @ApiErrors(
    ErrorCode.CATEGORY_NOT_FOUND,
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.INVALID_PARENT_CATEGORY,
    ErrorCode.CATEGORY_ALREADY_EXISTS,
  )
  update(
    @CurrentUser() user: AuthUser,
    @CategoryId() id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Exclui (soft delete) a categoria e suas subcategorias',
    description:
      'Se houver lançamentos/recorrências/orçamentos, exige `reassignTo`: lançamentos e recorrências migram para o destino; orçamentos das categorias excluídas são apagados.',
  })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.CATEGORY_NOT_FOUND, ErrorCode.CATEGORY_IN_USE, ErrorCode.VALIDATION_ERROR)
  remove(
    @CurrentUser() user: AuthUser,
    @CategoryId() id: string,
    @Query() query: DeleteCategoryQueryDto,
  ): Promise<void> {
    return this.categories.remove(user.id, id, query.reassignTo?.toLowerCase());
  }
}
