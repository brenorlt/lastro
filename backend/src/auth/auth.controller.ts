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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { SkipBilling } from '../common/decorators/skip-billing.decorator.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { ApiEnvelope, ApiErrors } from '../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { AppConfigService } from '../config/app-config.service.js';
import { REFRESH_COOKIE } from './auth.constants.js';
import { ACCEPTED_MESSAGE, type AuthResult, AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/auth-requests.dto.js';
import {
  AuthPayloadDto,
  MessageDto,
  PasswordChangedDto,
  ResetDoneDto,
  RevokedCountDto,
  SessionDto,
  UserDto,
  VerifiedDto,
} from './dto/auth-responses.dto.js';
import { clientContext } from './security/client-context.js';
import { RequireTrustedOrigin, TrustedOriginGuard } from './security/trusted-origin.guard.js';
import {
  clearSessionCookies,
  readRefreshCookie,
  setSessionCookies,
} from './sessions/auth-cookies.js';
import { extractBearerToken } from './tokens/access-token.service.js';

const MINUTE = 60_000;
const STRICT = { default: { limit: 5, ttl: MINUTE } };

@ApiTags('auth')
@UseGuards(TrustedOriginGuard)
@SkipBilling()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(STRICT)
  @ApiOperation({
    summary: 'Cria conta e envia e-mail de verificação',
    description:
      'Resposta idêntica para e-mail novo ou já cadastrado (anti-enumeração). Categorias padrão são criadas na mesma transação.',
  })
  @ApiEnvelope(MessageDto, { status: 202, description: 'Pedido aceito' })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.RATE_LIMITED)
  async register(@Body() dto: RegisterDto): Promise<MessageDto> {
    await this.auth.register(dto);
    return { message: ACCEPTED_MESSAGE };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Confirma o e-mail com o token do link' })
  @ApiEnvelope(VerifiedDto)
  @ApiErrors(ErrorCode.TOKEN_INVALID, ErrorCode.VALIDATION_ERROR, ErrorCode.RATE_LIMITED)
  verifyEmail(@Body() dto: TokenDto): Promise<VerifiedDto> {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Reenvia o e-mail de verificação (sempre 202)' })
  @ApiEnvelope(MessageDto, { status: 202 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.RATE_LIMITED)
  async resendVerification(@Body() dto: EmailDto): Promise<MessageDto> {
    await this.auth.resendVerification(dto.email);
    return { message: ACCEPTED_MESSAGE };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Login com e-mail e senha',
    description: `Retorna o access token e define os cookies \`${REFRESH_COOKIE}\` (httpOnly) e \`lastro_session\`.`,
  })
  @ApiEnvelope(AuthPayloadDto)
  @ApiErrors(
    ErrorCode.INVALID_CREDENTIALS,
    ErrorCode.EMAIL_NOT_VERIFIED,
    ErrorCode.ACCOUNT_LOCKED,
    ErrorCode.VALIDATION_ERROR,
    ErrorCode.RATE_LIMITED,
  )
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayloadDto> {
    return this.respond(res, await this.auth.login(dto, clientContext(req)));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @RequireTrustedOrigin({ allowMissing: false })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiHeader({ name: 'Origin', required: true, description: 'Deve estar em CORS_ORIGINS/APP_URL' })
  @ApiOperation({
    summary: 'Rotaciona o refresh token (cookie) e emite novo access token',
    description:
      'Cada uso gera um novo refresh token na mesma família. Reapresentar um token já rotacionado revoga toda a família (SESSION_REVOKED). Qualquer falha limpa os cookies.',
  })
  @ApiEnvelope(AuthPayloadDto)
  @ApiErrors(
    ErrorCode.UNAUTHORIZED,
    ErrorCode.SESSION_REVOKED,
    ErrorCode.SESSION_EXPIRED,
    ErrorCode.CSRF_REJECTED,
    ErrorCode.RATE_LIMITED,
  )
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayloadDto> {
    try {
      return this.respond(res, await this.auth.refresh(readRefreshCookie(req), clientContext(req)));
    } catch (error) {
      clearSessionCookies(res, this.config);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireTrustedOrigin({ allowMissing: true })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Encerra a sessão atual (cookie ou bearer) e limpa os cookies',
    description: 'Idempotente: 204 mesmo sem sessão.',
  })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.CSRF_REJECTED)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(
      readRefreshCookie(req),
      extractBearerToken(req.headers.authorization),
      clientContext(req),
    );
    clearSessionCookies(res, this.config);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuário autenticado' })
  @ApiEnvelope(UserDto)
  @ApiErrors(ErrorCode.UNAUTHORIZED, ErrorCode.TOKEN_EXPIRED, ErrorCode.SESSION_REVOKED)
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Envia link de redefinição de senha (sempre 202)' })
  @ApiEnvelope(MessageDto, { status: 202 })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.RATE_LIMITED)
  async forgotPassword(@Body() dto: EmailDto): Promise<MessageDto> {
    await this.auth.forgotPassword(dto.email);
    return { message: ACCEPTED_MESSAGE };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Define nova senha com o token do link e encerra todas as sessões' })
  @ApiEnvelope(ResetDoneDto)
  @ApiErrors(ErrorCode.TOKEN_INVALID, ErrorCode.VALIDATION_ERROR, ErrorCode.RATE_LIMITED)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request): Promise<ResetDoneDto> {
    return this.auth.resetPassword(dto, clientContext(req));
  }

  @Patch('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Troca a senha e encerra as demais sessões' })
  @ApiEnvelope(PasswordChangedDto)
  @ApiErrors(ErrorCode.INVALID_PASSWORD, ErrorCode.VALIDATION_ERROR, ErrorCode.UNAUTHORIZED)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<PasswordChangedDto> {
    return this.auth.changePassword(user, dto, clientContext(req));
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sessões ativas do usuário (mais recentes primeiro)' })
  @ApiEnvelope(SessionDto, { isArray: true })
  @ApiErrors(ErrorCode.UNAUTHORIZED)
  sessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.auth.listSessions(user);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra todas as sessões exceto a atual' })
  @ApiEnvelope(RevokedCountDto)
  @ApiErrors(ErrorCode.UNAUTHORIZED)
  revokeOthers(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<RevokedCountDto> {
    return this.auth.revokeOtherSessions(user, clientContext(req));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Encerra uma sessão do próprio usuário' })
  @ApiEnvelope(null, { status: 204 })
  @ApiErrors(ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const wasCurrent = await this.auth.revokeSession(user, id, clientContext(req));
    if (wasCurrent) clearSessionCookies(res, this.config);
  }

  private respond(res: Response, result: AuthResult): AuthPayloadDto {
    setSessionCookies(res, this.config, result.refreshToken, result.refreshExpiresAt);
    res.setHeader('Cache-Control', 'no-store');
    return result.payload;
  }
}
