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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  CreateLiabilityDto,
  LiabilityDetailDto,
  LiabilityDto,
  PayLiabilityDto,
  UpdateLiabilityDto,
} from './liability.dto.js';
import { LiabilitiesService } from './liabilities.service.js';

const LiabilityId = () => Param('id', new ParseIdPipe(ErrorCode.LIABILITY_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });

@ApiTags('liabilities')
@ApiBearerAuth()
@Controller('liabilities')
export class LiabilitiesController {
  constructor(private readonly liabilities: LiabilitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Dívidas com saldo total e parcelas mensais' })
  @ApiEnvelope(LiabilityDto, { isArray: true })
  list(@CurrentUser() user: AuthUser) {
    return this.liabilities.list(user.id);
  }

  @Get(':id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe com histórico de pagamentos' })
  @ApiEnvelope(LiabilityDetailDto)
  @ApiErrors(ErrorCode.LIABILITY_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @LiabilityId() id: string): Promise<LiabilityDetailDto> {
    return this.liabilities.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra dívida' })
  @ApiEnvelope(LiabilityDto, { status: 201 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLiabilityDto): Promise<LiabilityDto> {
    return this.liabilities.create(user.id, dto);
  }

  @Patch(':id')
  @IdParam()
  @ApiEnvelope(LiabilityDto)
  @ApiErrors(ErrorCode.LIABILITY_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @LiabilityId() id: string,
    @Body() dto: UpdateLiabilityDto,
  ) {
    return this.liabilities.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdParam()
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.LIABILITY_NOT_FOUND)
  remove(@CurrentUser() user: AuthUser, @LiabilityId() id: string): Promise<void> {
    return this.liabilities.remove(user.id, id);
  }

  @Post(':id/payments')
  @IdParam()
  @ApiOperation({
    summary: 'Registra pagamento (abate o saldo devedor)',
    description:
      'Não separa juros e principal: o valor inteiro abate o saldo. accountId debita a conta.',
  })
  @ApiEnvelope(LiabilityDetailDto, { status: 201 })
  @ApiErrors(
    ErrorCode.LIABILITY_NOT_FOUND,
    ErrorCode.PAYMENT_EXCEEDS_BALANCE,
    ErrorCode.ACCOUNT_NOT_FOUND,
    ErrorCode.ACCOUNT_ARCHIVED,
    ErrorCode.VALIDATION_ERROR,
  )
  pay(@CurrentUser() user: AuthUser, @LiabilityId() id: string, @Body() dto: PayLiabilityDto) {
    return this.liabilities.pay(user.id, id, dto);
  }
}
