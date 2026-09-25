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
  ContributionResultDto,
  CreateContributionDto,
  CreateGoalDto,
  GoalDetailDto,
  GoalDto,
  GoalsMetaDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './goal.dto.js';
import { GoalsService } from './goals.service.js';

const GoalId = () => Param('id', new ParseIdPipe(ErrorCode.GOAL_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });

@ApiTags('goals')
@ApiBearerAuth()
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Metas (prioridade desc, data-alvo asc) com totais' })
  @ApiExtraModels(GoalDto, GoalsMetaDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(GoalDto) } },
        meta: { $ref: getSchemaPath(GoalsMetaDto) },
      },
    },
  })
  list(@CurrentUser() user: AuthUser, @Query() query: ListGoalsQueryDto) {
    return this.goals.list(user.id, query);
  }

  @Get(':id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe com últimos 50 aportes e série de 12 meses' })
  @ApiEnvelope(GoalDetailDto)
  @ApiErrors(ErrorCode.GOAL_NOT_FOUND)
  get(@CurrentUser() user: AuthUser, @GoalId() id: string): Promise<GoalDetailDto> {
    return this.goals.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria meta (currentAmount vira aporte "Valor inicial")' })
  @ApiEnvelope(GoalDto, { status: 201 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoalDto): Promise<GoalDto> {
    return this.goals.create(user.id, dto);
  }

  @Patch(':id')
  @IdParam()
  @ApiOperation({ summary: 'Edita meta (status: ACTIVE | PAUSED | ARCHIVED)' })
  @ApiEnvelope(GoalDto)
  @ApiErrors(ErrorCode.GOAL_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  update(
    @CurrentUser() user: AuthUser,
    @GoalId() id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    return this.goals.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @IdParam()
  @ApiOperation({ summary: 'Exclui (soft delete)' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.GOAL_NOT_FOUND)
  remove(@CurrentUser() user: AuthUser, @GoalId() id: string): Promise<void> {
    return this.goals.remove(user.id, id);
  }

  @Post(':id/contributions')
  @IdParam()
  @ApiOperation({ summary: 'Registra aporte (positivo) ou resgate (negativo)' })
  @ApiEnvelope(ContributionResultDto, { status: 201 })
  @ApiErrors(
    ErrorCode.GOAL_NOT_FOUND,
    ErrorCode.GOAL_INSUFFICIENT_BALANCE,
    ErrorCode.VALIDATION_ERROR,
  )
  contribute(
    @CurrentUser() user: AuthUser,
    @GoalId() id: string,
    @Body() dto: CreateContributionDto,
  ): Promise<ContributionResultDto> {
    return this.goals.addContribution(user.id, id, dto);
  }

  @Delete(':id/contributions/:cid')
  @IdParam()
  @ApiParam({ name: 'cid', format: 'uuid' })
  @ApiOperation({ summary: 'Remove um aporte' })
  @ApiEnvelope(GoalDto)
  @ApiErrors(
    ErrorCode.GOAL_NOT_FOUND,
    ErrorCode.CONTRIBUTION_NOT_FOUND,
    ErrorCode.GOAL_INSUFFICIENT_BALANCE,
  )
  removeContribution(
    @CurrentUser() user: AuthUser,
    @GoalId() id: string,
    @Param('cid', new ParseIdPipe(ErrorCode.CONTRIBUTION_NOT_FOUND)) cid: string,
  ): Promise<GoalDto> {
    return this.goals.removeContribution(user.id, id, cid);
  }
}
