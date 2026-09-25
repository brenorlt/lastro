import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  AdjustEmergencyFundDto,
  EmergencyFundDto,
  PutEmergencyFundDto,
} from './emergency-fund.dto.js';
import { EmergencyFundService } from './emergency-fund.service.js';

@ApiTags('emergency-fund')
@ApiBearerAuth()
@Controller('emergency-fund')
export class EmergencyFundController {
  constructor(private readonly fund: EmergencyFundService) {}

  @Get()
  @ApiOperation({ summary: 'Reserva de emergência (data: null se nunca configurada)' })
  @ApiEnvelope(EmergencyFundDto)
  get(@CurrentUser() user: AuthUser): Promise<EmergencyFundDto | null> {
    return this.fund.get(user.id);
  }

  @Put()
  @ApiOperation({
    summary: 'Configura a reserva (upsert)',
    description:
      'linkedAccountId presente = modo LINKED (valor acompanha o saldo da conta); omitido/null = MANUAL. targetAmount omitido = monthlyCost × targetMonths.',
  })
  @ApiEnvelope(EmergencyFundDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.ACCOUNT_NOT_FOUND, ErrorCode.ACCOUNT_ARCHIVED)
  put(@CurrentUser() user: AuthUser, @Body() dto: PutEmergencyFundDto): Promise<EmergencyFundDto> {
    return this.fund.put(user.id, dto);
  }

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajusta o valor manual (±); indisponível no modo LINKED' })
  @ApiEnvelope(EmergencyFundDto)
  @ApiErrors(
    ErrorCode.EMERGENCY_FUND_NOT_FOUND,
    ErrorCode.EMERGENCY_FUND_LINKED,
    ErrorCode.VALIDATION_ERROR,
  )
  adjust(
    @CurrentUser() user: AuthUser,
    @Body() dto: AdjustEmergencyFundDto,
  ): Promise<EmergencyFundDto> {
    return this.fund.adjust(user.id, dto.amount);
  }
}
