import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { DashboardDto, DashboardQueryDto } from './dashboard.dto.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Agregados do painel para um mês',
    description:
      'Patrimônio (série de 12 meses reconstruída a partir do fluxo CLEARED, ou snapshots de fim de mês), fluxo, reserva, compromissos, gastos por categoria raiz, metas, próximos/recentes e insights.',
  })
  @ApiEnvelope(DashboardDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  get(@CurrentUser() user: AuthUser, @Query() query: DashboardQueryDto) {
    return this.dashboard.get(user.id, query.month);
  }
}
