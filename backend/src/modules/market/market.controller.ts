import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { MarketInsightsDto } from './market.dto.js';
import { MarketService } from './market.service.js';

@ApiTags('market')
@ApiBearerAuth()
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('insights')
  @ApiOperation({
    summary: 'Destaques de mercado para o painel',
    description:
      'Dólar, euro e bitcoin (AwesomeAPI), ações da B3 acompanhadas e as da carteira do usuário (brapi). Cache de 10 min; se uma fonte falhar, usa o último valor conhecido ou omite os itens dela.',
  })
  @ApiEnvelope(MarketInsightsDto)
  @ApiErrors(ErrorCode.UNAUTHORIZED)
  insights(@CurrentUser() user: AuthUser): Promise<MarketInsightsDto> {
    return this.market.insightsFor(user.id);
  }
}
