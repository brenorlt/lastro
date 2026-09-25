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
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { clientContext } from '../../auth/security/client-context.js';
import { clearSessionCookies } from '../../auth/sessions/auth-cookies.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipBilling } from '../../common/decorators/skip-billing.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { OnboardingDto, OnboardingResultDto } from './dto/onboarding.dto.js';
import { DeleteMeDto, UpdateUserDto } from './dto/update-user.dto.js';
import { OnboardingService } from './onboarding.service.js';
import { UserDto } from './dto/user.dto.js';
import { UploadErrorsInterceptor } from './upload-errors.interceptor.js';
import { UsersService } from './users.service.js';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

@ApiTags('users')
@SkipBilling()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly avatars: AvatarStorageService,
    private readonly config: AppConfigService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Post('me/onboarding')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Conclui o onboarding criando conta principal, investimentos, dívidas, reserva e meta',
    description:
      'Tudo numa transação. Salva as respostas brutas (renda, gastos, categorias) em onboardingAnswers.',
  })
  @ApiEnvelope(OnboardingResultDto, { status: 201 })
  @ApiErrors(ErrorCode.ONBOARDING_ALREADY_COMPLETED, ErrorCode.VALIDATION_ERROR)
  completeOnboarding(
    @CurrentUser() user: AuthUser,
    @Body() dto: OnboardingDto,
  ): Promise<OnboardingResultDto> {
    return this.onboarding.complete(user.id, dto);
  }

  @Post('me/onboarding/skip')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pula o onboarding (marca como concluído)' })
  @ApiEnvelope(UserDto)
  @ApiErrors(ErrorCode.ONBOARDING_ALREADY_COMPLETED)
  skipOnboarding(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.onboarding.skip(user.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  @ApiEnvelope(UserDto)
  @ApiErrors(ErrorCode.UNAUTHORIZED)
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.me(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualiza perfil e preferências',
    description: 'E-mail não é editável aqui. `notificationPrefs` é mesclado em profundidade.',
  })
  @ApiEnvelope(UserDto)
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.UNAUTHORIZED)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.users.update(user.id, dto);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseInterceptors(
    UploadErrorsInterceptor,
    FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'JPEG, PNG ou WebP, até 2 MB' },
      },
    },
  })
  @ApiOperation({ summary: 'Envia/substitui o avatar (tipo verificado por magic bytes)' })
  @ApiEnvelope(UserDto)
  @ApiErrors(ErrorCode.INVALID_FILE_TYPE, ErrorCode.FILE_TOO_LARGE, ErrorCode.VALIDATION_ERROR)
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserDto> {
    return this.users.setAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove o avatar' })
  @ApiEnvelope(UserDto)
  @ApiErrors(ErrorCode.UNAUTHORIZED)
  removeAvatar(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.removeAvatar(user.id);
  }

  @Public()
  @SkipThrottle()
  @Get('avatars/:file')
  @ApiParam({ name: 'file', example: '0123456789abcdef0123456789abcdef.png' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOperation({ summary: 'Serve um avatar (público, cache imutável)' })
  @ApiResponse({ status: 200, description: 'Imagem' })
  @ApiErrors(ErrorCode.NOT_FOUND)
  async avatar(
    @Param('file') file: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const found = await this.avatars.open(file);
    if (!found) throw new AppException(ErrorCode.NOT_FOUND);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(found.stream, { type: found.mime, length: found.size });
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Exclui a conta definitivamente',
    description:
      'Hard delete: remove todos os dados financeiros (cascade), o avatar e limpa os cookies de sessão.',
  })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.INVALID_PASSWORD, ErrorCode.VALIDATION_ERROR, ErrorCode.RATE_LIMITED)
  async deleteMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteMeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteAccount(user.id, dto.password, clientContext(req));
    clearSessionCookies(res, this.config);
  }
}
