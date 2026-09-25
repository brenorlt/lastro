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
  CardDto,
  CardsMetaDto,
  CreateCardDto,
  InvoiceDetailDto,
  InvoiceRangeQueryDto,
  InvoiceSummaryDto,
  ListCardsQueryDto,
  PayInvoiceDto,
  PaymentResultDto,
  SpendingPointDto,
  SpendingQueryDto,
  UpdateCardDto,
} from './card.dto.js';
import { CardsService } from './cards.service.js';

const CardId = () => Param('id', new ParseIdPipe(ErrorCode.CARD_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });
const RefParam = () =>
  ApiParam({ name: 'ref', example: '2026-10', description: 'Mês do vencimento (AAAA-MM)' });

@ApiTags('cards')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  @ApiOperation({
    summary: 'Cartões com limite usado/disponível, fatura atual e próximo vencimento',
  })
  @ApiExtraModels(CardDto, CardsMetaDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(CardDto) } },
        meta: { $ref: getSchemaPath(CardsMetaDto) },
      },
    },
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListCardsQueryDto) {
    return this.cards.list(user.id, query.status);
  }

  @Get(':id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe do cartão' })
  @ApiEnvelope(CardDto)
  @ApiErrors(ErrorCode.CARD_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<CardDto> {
    return this.cards.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra cartão' })
  @ApiEnvelope(CardDto, { status: 201 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.CARD_NAME_TAKEN, ErrorCode.ACCOUNT_NOT_FOUND)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCardDto): Promise<CardDto> {
    return this.cards.create(user.id, dto);
  }

  @Patch(':id')
  @IdParam()
  @ApiOperation({
    summary: 'Edita cartão',
    description: 'Novos dias de fechamento/vencimento valem apenas para compras futuras.',
  })
  @ApiEnvelope(CardDto)
  @ApiErrors(ErrorCode.CARD_NOT_FOUND, ErrorCode.CARD_NAME_TAKEN, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @CardId() id: string,
    @Body() dto: UpdateCardDto,
  ): Promise<CardDto> {
    return this.cards.update(user.id, id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @IdParam()
  @ApiOperation({ summary: 'Arquiva o cartão' })
  @ApiEnvelope(CardDto)
  @ApiErrors(ErrorCode.CARD_NOT_FOUND)
  archive(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<CardDto> {
    return this.cards.setArchived(user.id, id, true);
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  @IdParam()
  @ApiOperation({ summary: 'Reativa o cartão' })
  @ApiEnvelope(CardDto)
  @ApiErrors(ErrorCode.CARD_NOT_FOUND, ErrorCode.CARD_NAME_TAKEN)
  unarchive(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<CardDto> {
    return this.cards.setArchived(user.id, id, false);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdParam()
  @ApiOperation({ summary: 'Exclui (soft) um cartão sem lançamentos' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.CARD_NOT_FOUND, ErrorCode.CARD_IN_USE)
  remove(@CurrentUser() user: AuthUser, @CardId() id: string): Promise<void> {
    return this.cards.remove(user.id, id);
  }

  @Get(':id/invoices')
  @IdParam()
  @ApiOperation({ summary: 'Faturas por mês de vencimento (inclui meses virtuais zerados)' })
  @ApiEnvelope(InvoiceSummaryDto, { isArray: true })
  @ApiErrors(ErrorCode.CARD_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  invoices(
    @CurrentUser() user: AuthUser,
    @CardId() id: string,
    @Query() query: InvoiceRangeQueryDto,
  ) {
    return this.cards.invoices(user.id, id, query.from, query.to);
  }

  @Get(':id/spending')
  @IdParam()
  @ApiOperation({ summary: 'Total por fatura nos últimos N meses (até a fatura atual)' })
  @ApiEnvelope(SpendingPointDto, { isArray: true })
  @ApiErrors(ErrorCode.CARD_NOT_FOUND)
  spending(@CurrentUser() user: AuthUser, @CardId() id: string, @Query() query: SpendingQueryDto) {
    return this.cards.spending(user.id, id, query.months ?? 6);
  }

  @Get(':id/invoices/:ref')
  @IdParam()
  @RefParam()
  @ApiOperation({ summary: 'Fatura com compras, pagamentos e gastos por categoria' })
  @ApiEnvelope(InvoiceDetailDto)
  @ApiErrors(ErrorCode.CARD_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  invoice(@CurrentUser() user: AuthUser, @CardId() id: string, @Param('ref') ref: string) {
    return this.cards.invoiceDetail(user.id, id, ref);
  }

  @Post(':id/invoices/:ref/pay')
  @IdParam()
  @RefParam()
  @ApiOperation({
    summary: 'Paga a fatura (total ou parcial) a partir de uma conta',
    description:
      'Cria uma TRANSFER vinculada à fatura: debita a conta e soma em paidAmount. Antecipação permitida.',
  })
  @ApiEnvelope(PaymentResultDto, { status: 201 })
  @ApiErrors(
    ErrorCode.CARD_NOT_FOUND,
    ErrorCode.INVOICE_NOT_FOUND,
    ErrorCode.PAYMENT_EXCEEDS_INVOICE,
    ErrorCode.ACCOUNT_NOT_FOUND,
    ErrorCode.ACCOUNT_ARCHIVED,
    ErrorCode.VALIDATION_ERROR,
  )
  pay(
    @CurrentUser() user: AuthUser,
    @CardId() id: string,
    @Param('ref') ref: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.cards.pay(user.id, id, ref, dto);
  }
}
