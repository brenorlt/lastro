import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  Body,
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
import { SkipBilling } from '../../common/decorators/skip-billing.decorator.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import {
  AdminOverviewDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUsersQueryDto,
  GrantAccessDto,
} from './dto/admin.dto.js';

const UserId = () => Param('id', new ParseIdPipe(ErrorCode.USER_NOT_FOUND));
const IdParam = () => ApiParam({ name: 'id', format: 'uuid' });

@ApiTags('admin')
@ApiBearerAuth()
@SkipBilling()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Resumo: usuários, assinaturas, MRR estimado, cadastros e pagamentos recentes',
  })
  @ApiEnvelope(AdminOverviewDto)
  @ApiErrors(ErrorCode.FORBIDDEN)
  overview(): Promise<AdminOverviewDto> {
    return this.admin.overview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Lista usuários com busca por nome/e-mail e paginação' })
  @ApiExtraModels(AdminUserListItemDto)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { $ref: getSchemaPath(AdminUserListItemDto) } },
      },
    },
  })
  @ApiErrors(ErrorCode.FORBIDDEN)
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @IdParam()
  @ApiOperation({ summary: 'Detalhe de um usuário: perfil, assinatura e histórico de pagamentos' })
  @ApiEnvelope(AdminUserDetailDto)
  @ApiErrors(ErrorCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND)
  getUser(@UserId() id: string): Promise<AdminUserDetailDto> {
    return this.admin.getUser(id);
  }

  @Post('users/:id/grant-access')
  @IdParam()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Concede acesso manual por N dias (suporte/cortesia)' })
  @ApiEnvelope(null, { status: 200 })
  @ApiErrors(ErrorCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND, ErrorCode.VALIDATION_ERROR)
  async grantAccess(@UserId() id: string, @Body() dto: GrantAccessDto): Promise<null> {
    await this.admin.grantAccess(id, dto.days);
    return null;
  }

  @Post('users/:id/block')
  @IdParam()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bloqueia o acesso do usuário imediatamente' })
  @ApiEnvelope(null, { status: 200 })
  @ApiErrors(ErrorCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND)
  async block(@UserId() id: string): Promise<null> {
    await this.admin.block(id);
    return null;
  }

  @Post('users/:id/unblock')
  @IdParam()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desbloqueia o usuário (mantém o ciclo vigente ou concede 30 dias)' })
  @ApiEnvelope(null, { status: 200 })
  @ApiErrors(ErrorCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND)
  async unblock(@UserId() id: string): Promise<null> {
    await this.admin.unblock(id);
    return null;
  }
}
