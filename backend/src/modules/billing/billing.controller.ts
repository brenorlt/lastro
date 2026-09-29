import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipBilling } from '../../common/decorators/skip-billing.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AppRequest } from '../../common/types/http.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { BillingService } from './billing.service.js';
import { BillingStatusDto, BoletoCheckoutDto, PixCheckoutDto } from './billing.dto.js';

@ApiTags('billing')
@SkipBilling()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Status da assinatura do usuário (trial, ativa, bloqueada...)' })
  @ApiEnvelope(BillingStatusDto)
  status(@CurrentUser() user: AuthUser): Promise<BillingStatusDto> {
    return this.billing.getStatus(user.id);
  }

  @Post('checkout/pix')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gera uma cobrança Pix avulsa (30 dias de acesso)' })
  @ApiEnvelope(PixCheckoutDto)
  checkoutPix(@CurrentUser() user: AuthUser): Promise<PixCheckoutDto> {
    return this.billing.checkoutPix(user.id);
  }

  @Post('checkout/boleto')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gera uma cobrança de boleto avulsa (30 dias de acesso)' })
  @ApiEnvelope(BoletoCheckoutDto)
  checkoutBoleto(@CurrentUser() user: AuthUser): Promise<BoletoCheckoutDto> {
    return this.billing.checkoutBoleto(user.id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe eventos da AbacatePay (chamado só pela AbacatePay)' })
  @ApiEnvelope(null, { status: 200 })
  @ApiErrors(ErrorCode.WEBHOOK_SIGNATURE_INVALID)
  async webhook(
    @Req() req: RawBodyRequest<AppRequest>,
    @Query('webhookSecret') webhookSecret: string | undefined,
    @Headers('x-webhook-signature') signature: string | undefined,
  ): Promise<{ ok: true }> {
    await this.billing.handleWebhook(req.rawBody ?? Buffer.alloc(0), webhookSecret, signature);
    return { ok: true };
  }
}
