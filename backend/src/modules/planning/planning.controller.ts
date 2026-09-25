import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PlanningAssumptionsDto, PlanningBaselineDto } from './planning.dto.js';
import { PlanningService } from './planning.service.js';

@ApiTags('planning')
@ApiBearerAuth()
@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get('baseline')
  @ApiOperation({ summary: 'Ponto de partida das projeções (patrimônio, médias mensais, metas)' })
  @ApiEnvelope(PlanningBaselineDto)
  baseline(@CurrentUser() user: AuthUser): Promise<PlanningBaselineDto> {
    return this.planning.baseline(user.id);
  }

  @Get('assumptions')
  @ApiOperation({ summary: 'Premissas salvas (ou padrões)' })
  @ApiEnvelope(PlanningAssumptionsDto)
  assumptions(@CurrentUser() user: AuthUser): Promise<PlanningAssumptionsDto> {
    return this.planning.assumptions(user.id);
  }

  @Put('assumptions')
  @ApiOperation({ summary: 'Salva as premissas (objeto completo)' })
  @ApiEnvelope(PlanningAssumptionsDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  save(
    @CurrentUser() user: AuthUser,
    @Body() dto: PlanningAssumptionsDto,
  ): Promise<PlanningAssumptionsDto> {
    return this.planning.saveAssumptions(user.id, dto);
  }
}
