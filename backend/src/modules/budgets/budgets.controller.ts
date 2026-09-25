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
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  BudgetDto,
  BudgetsMetaDto,
  BudgetSuggestionDto,
  CopyBudgetsDto,
  CopyResultDto,
  CreateBudgetDto,
  MonthQueryDto,
  UpdateBudgetDto,
} from './budget.dto.js';
import { BudgetsService } from './budgets.service.js';

const BudgetId = () => Param('id', new ParseIdPipe(ErrorCode.BUDGET_NOT_FOUND));

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Orçamentos do mês (maior % primeiro) com totais',
    description: 'spent = despesas CLEARED + PENDING da categoria e, se raiz, das subcategorias.',
  })
  @ApiExtraModels(BudgetDto, BudgetsMetaDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(BudgetDto) } },
        meta: { $ref: getSchemaPath(BudgetsMetaDto) },
      },
    },
  })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  list(@CurrentUser() user: AuthUser, @Query() query: MonthQueryDto) {
    return this.budgets.list(user.id, query.month);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Sugestões de orçamento a partir da média dos 3 meses completos anteriores',
  })
  @ApiEnvelope(BudgetSuggestionDto, { isArray: true })
  suggestions(
    @CurrentUser() user: AuthUser,
    @Query() query: MonthQueryDto,
  ): Promise<BudgetSuggestionDto[]> {
    return this.budgets.suggestions(user.id, query.month);
  }

  @Post()
  @ApiOperation({ summary: 'Cria orçamento mensal para uma categoria de despesa' })
  @ApiEnvelope(BudgetDto, { status: 201 })
  @ApiErrors(
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.CATEGORY_NOT_FOUND,
    ErrorCode.CATEGORY_TYPE_MISMATCH,
    ErrorCode.BUDGET_ALREADY_EXISTS,
    ErrorCode.BUDGET_OVERLAP,
  )
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBudgetDto): Promise<BudgetDto> {
    return this.budgets.create(user.id, dto);
  }

  @Post('copy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Copia limites de um mês para outro (pula existentes/sobrepostos)' })
  @ApiEnvelope(CopyResultDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  copy(@CurrentUser() user: AuthUser, @Body() dto: CopyBudgetsDto): Promise<CopyResultDto> {
    return this.budgets.copy(user.id, dto.fromMonth, dto.toMonth);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Altera o limite' })
  @ApiEnvelope(BudgetDto)
  @ApiErrors(ErrorCode.BUDGET_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @BudgetId() id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetDto> {
    return this.budgets.update(user.id, id, dto.limitAmount);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Exclui o orçamento' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.BUDGET_NOT_FOUND)
  remove(@CurrentUser() user: AuthUser, @BudgetId() id: string): Promise<void> {
    return this.budgets.remove(user.id, id);
  }
}
