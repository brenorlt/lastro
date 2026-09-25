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
import {
  CreateInvestmentDto,
  CreateInvestmentTxDto,
  InvestmentDetailDto,
  InvestmentDto,
  ListInvestmentsQueryDto,
  PortfolioSeriesPointDto,
  SeriesQueryDto,
  UpdateInvestmentDto,
} from './investment.dto.js';
import { InvestmentsService } from './investments.service.js';

const InvestmentId = () => Param('id', new ParseIdPipe(ErrorCode.INVESTMENT_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });
const WRITE_ERRORS = [
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.ACCOUNT_NOT_FOUND,
  ErrorCode.ACCOUNT_ARCHIVED,
] as const;

@ApiTags('investments')
@ApiBearerAuth()
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Carteira (maior valor primeiro) com totais e alocação por classe' })
  @ApiEnvelope(InvestmentDto, { isArray: true })
  list(@CurrentUser() user: AuthUser, @Query() query: ListInvestmentsQueryDto) {
    return this.investments.list(user.id, query.type);
  }

  @Get('series')
  @ApiOperation({ summary: 'Evolução da carteira (valor, custo e aportes líquidos por mês)' })
  @ApiEnvelope(PortfolioSeriesPointDto, { isArray: true })
  series(
    @CurrentUser() user: AuthUser,
    @Query() query: SeriesQueryDto,
  ): Promise<PortfolioSeriesPointDto[]> {
    return this.investments.portfolioSeries(user.id, query.months ?? 12);
  }

  @Get(':id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe com movimentações e série de 12 meses' })
  @ApiEnvelope(InvestmentDetailDto)
  @ApiErrors(ErrorCode.INVESTMENT_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @InvestmentId() id: string): Promise<InvestmentDetailDto> {
    return this.investments.get(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastra investimento (BUY inicial); fundingAccountId debita a conta',
    description:
      'Sem fundingAccountId é apenas o registro de uma posição existente (sem movimento de caixa).',
  })
  @ApiEnvelope(InvestmentDto, { status: 201 })
  @ApiErrors(...WRITE_ERRORS)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvestmentDto): Promise<InvestmentDto> {
    return this.investments.create(user.id, dto);
  }

  @Patch(':id')
  @IdParam()
  @ApiOperation({ summary: 'Edita dados cadastrais (a posição vem das movimentações)' })
  @ApiEnvelope(InvestmentDto)
  @ApiErrors(ErrorCode.INVESTMENT_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @InvestmentId() id: string,
    @Body() dto: UpdateInvestmentDto,
  ) {
    return this.investments.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdParam()
  @ApiOperation({ summary: 'Exclui (soft); lançamentos de caixa já gerados permanecem' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.INVESTMENT_NOT_FOUND)
  remove(@CurrentUser() user: AuthUser, @InvestmentId() id: string): Promise<void> {
    return this.investments.remove(user.id, id);
  }

  @Post(':id/transactions')
  @IdParam()
  @ApiOperation({
    summary: 'Registra movimentação (BUY/SELL/DIVIDEND/INTEREST/FEE/VALUATION)',
    description:
      'accountId movimenta o caixa: BUY sai da conta, SELL entra (transferências neutras); DIVIDEND/INTEREST geram receita e FEE despesa. A posição é recalculada reexecutando todas as movimentações.',
  })
  @ApiEnvelope(InvestmentDetailDto, { status: 201 })
  @ApiErrors(...WRITE_ERRORS, ErrorCode.INVESTMENT_NOT_FOUND, ErrorCode.INVESTMENT_INSUFFICIENT)
  addTx(
    @CurrentUser() user: AuthUser,
    @InvestmentId() id: string,
    @Body() dto: CreateInvestmentTxDto,
  ) {
    return this.investments.addTransaction(user.id, id, dto);
  }

  @Delete(':id/transactions/:tid')
  @IdParam()
  @ApiParam({ name: 'tid', format: 'uuid' })
  @ApiOperation({ summary: 'Remove movimentação (desfaz o caixa vinculado) e recalcula' })
  @ApiEnvelope(InvestmentDetailDto)
  @ApiErrors(
    ErrorCode.INVESTMENT_NOT_FOUND,
    ErrorCode.INVESTMENT_TX_NOT_FOUND,
    ErrorCode.INVESTMENT_INSUFFICIENT,
  )
  removeTx(
    @CurrentUser() user: AuthUser,
    @InvestmentId() id: string,
    @Param('tid', new ParseIdPipe(ErrorCode.INVESTMENT_TX_NOT_FOUND)) tid: string,
  ) {
    return this.investments.removeTransaction(user.id, id, tid);
  }
}
