import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { NetWorthService } from './net-worth.service.js';

@ApiTags('net-worth')
@ApiBearerAuth()
@Controller('net-worth')
export class NetWorthController {
  constructor(private readonly netWorth: NetWorthService) {}

  @Get()
  @ApiOperation({
    summary: 'Patrimônio agrupado (ativos/passivos), índice de endividamento e série de 12 meses',
    description:
      'Grupos de ativos: CASH, INVESTMENTS (inclui saldo em corretora), REAL_ESTATE, VEHICLE, OTHER. Passivos: CREDIT_CARD, LOAN, FINANCING, DEBT, OTHER. O total é idêntico ao netWorth do dashboard.',
  })
  @ApiOkResponse({
    description: '{ netWorth, assets, liabilities, debtRatio, series, seriesMethod, change12m }',
  })
  get(@CurrentUser() user: AuthUser) {
    return this.netWorth.get(user.id);
  }
}
