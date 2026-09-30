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
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  ScopeQueryDto,
  TransactionDto,
  TransactionListMetaDto,
  UpdateTransactionDto,
} from './dto/transaction.dto.js';
import { TransactionsService } from './transactions.service.js';

const TransactionId = () => Param('id', new ParseIdPipe(ErrorCode.TRANSACTION_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });
const WRITE_ERRORS = [
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.ACCOUNT_NOT_FOUND,
  ErrorCode.ACCOUNT_ARCHIVED,
  ErrorCode.CATEGORY_NOT_FOUND,
  ErrorCode.CATEGORY_TYPE_MISMATCH,
] as const;

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista lançamentos com filtros, ordenação, paginação e totais do filtro inteiro',
    description:
      'totals cobrem todo o conjunto filtrado (não só a página), ambos os status; transferências são neutras.',
  })
  @ApiExtraModels(TransactionDto, TransactionListMetaDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(TransactionDto) } },
        meta: { $ref: getSchemaPath(TransactionListMetaDto) },
      },
    },
  })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  list(@CurrentUser() user: AuthUser, @Query() query: ListTransactionsQueryDto) {
    return this.transactions.list(user.id, query);
  }

  @Get(':id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe de um lançamento' })
  @ApiEnvelope(TransactionDto)
  @ApiErrors(ErrorCode.TRANSACTION_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @TransactionId() id: string): Promise<TransactionDto> {
    return this.transactions.get(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria receita/despesa (avulsa, parcelada ou recorrente)',
    description:
      'Parcelado: `amount` é o TOTAL, dividido em centavos exatos (resto na 1ª parcela), uma por mês a partir de `date`. Recorrente: cria o modelo e materializa até hoje + 60 dias. Retorna todas as linhas criadas, por data.',
  })
  @ApiEnvelope(TransactionDto, { status: 201, isArray: true })
  @ApiErrors(...WRITE_ERRORS)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto[]> {
    return this.transactions.create(user.id, dto);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Transferência entre contas (uma linha: origem → destino)' })
  @ApiEnvelope(TransactionDto, { status: 201 })
  @ApiErrors(...WRITE_ERRORS, ErrorCode.SAME_ACCOUNT_TRANSFER)
  transfer(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto): Promise<TransactionDto> {
    return this.transactions.createTransfer(user.id, dto);
  }

  @Patch(':id')
  @IdParam()
  @ApiOperation({
    summary: 'Edita um lançamento (scope=single|future|all para séries)',
    description:
      'Em séries, data e status valem só para esta linha; valor propaga apenas em recorrências. Em recorrências, future/all também atualizam o modelo. `type` não é editável.',
  })
  @ApiEnvelope(TransactionDto, { isArray: true })
  @ApiErrors(...WRITE_ERRORS, ErrorCode.TRANSACTION_NOT_FOUND, ErrorCode.SAME_ACCOUNT_TRANSFER)
  update(
    @CurrentUser() user: AuthUser,
    @TransactionId() id: string,
    @Query() query: ScopeQueryDto,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto[]> {
    return this.transactions.update(user.id, id, dto, query.scope);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @IdParam()
  @ApiOperation({ summary: 'Marca como CLEARED (afeta o saldo), inclusive com data futura' })
  @ApiEnvelope(TransactionDto)
  @ApiErrors(ErrorCode.TRANSACTION_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  confirm(@CurrentUser() user: AuthUser, @TransactionId() id: string): Promise<TransactionDto> {
    return this.transactions.setStatus(user.id, id, 'CLEARED');
  }

  @Post(':id/unconfirm')
  @HttpCode(HttpStatus.OK)
  @IdParam()
  @ApiOperation({ summary: 'Volta para PENDING (desfaz o efeito no saldo)' })
  @ApiEnvelope(TransactionDto)
  @ApiErrors(ErrorCode.TRANSACTION_NOT_FOUND)
  unconfirm(@CurrentUser() user: AuthUser, @TransactionId() id: string): Promise<TransactionDto> {
    return this.transactions.setStatus(user.id, id, 'PENDING');
  }

  @Post(':id/duplicate')
  @IdParam()
  @ApiOperation({ summary: 'Duplica como lançamento avulso com data de hoje' })
  @ApiEnvelope(TransactionDto, { status: 201 })
  @ApiErrors(ErrorCode.TRANSACTION_NOT_FOUND, ErrorCode.ACCOUNT_ARCHIVED)
  duplicate(@CurrentUser() user: AuthUser, @TransactionId() id: string): Promise<TransactionDto> {
    return this.transactions.duplicate(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdParam()
  @ApiOperation({
    summary: 'Exclui (scope=single|future|all); em recorrências future/all desativam o modelo',
  })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.TRANSACTION_NOT_FOUND)
  remove(
    @CurrentUser() user: AuthUser,
    @TransactionId() id: string,
    @Query() query: ScopeQueryDto,
  ): Promise<void> {
    return this.transactions.remove(user.id, id, query.scope);
  }
}
