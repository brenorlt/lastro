import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { clientContext } from '../../auth/security/client-context.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AppOAuthService, type AuthorizeParams, OAuthError } from './app-oauth.service.js';

const MINUTE = 60_000;

/** Parâmetros do pedido de autorização, como chegam na URL (RFC 6749 §4.1.1 + PKCE + RFC 8707). */
export class AuthorizeQueryDto {
  @IsOptional() @IsString() @MaxLength(32) response_type?: string;
  @IsOptional() @IsString() @MaxLength(64) client_id?: string;
  @IsOptional() @IsString() @MaxLength(2048) redirect_uri?: string;
  @IsOptional() @IsString() @MaxLength(128) code_challenge?: string;
  @IsOptional() @IsString() @MaxLength(16) code_challenge_method?: string;
  @IsOptional() @IsString() @MaxLength(255) scope?: string;
  @IsOptional() @IsString() @MaxLength(1024) state?: string;
  @IsOptional() @IsString() @MaxLength(512) resource?: string;
}

export class ConsentDto extends AuthorizeQueryDto {
  @IsBoolean() approve: boolean;
}

function toParams(q: AuthorizeQueryDto): AuthorizeParams {
  return {
    responseType: q.response_type,
    clientId: q.client_id,
    redirectUri: q.redirect_uri,
    codeChallenge: q.code_challenge,
    codeChallengeMethod: q.code_challenge_method,
    scope: q.scope,
    state: q.state,
    resource: q.resource,
  };
}

const AUTHORIZE_KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'state',
  'resource',
] as const;

/**
 * Clientes mandam parâmetros extras (prompt, etc.): a URL de authorize não passa pelo
 * ValidationPipe (que rejeitaria campos desconhecidos). Só os conhecidos, só strings curtas.
 */
function pickAuthorize(raw: Record<string, unknown>): AuthorizeQueryDto {
  const out: Record<string, string> = {};
  for (const key of AUTHORIZE_KEYS) {
    const v = raw[key];
    if (typeof v === 'string' && v.length <= 2048) out[key] = v;
  }
  return out;
}

/** Respostas OAuth não usam o envelope `{ success, data }` da API: vão cruas, sem cache. */
function sendJson(res: Response, status: number, body: unknown) {
  res.status(status).set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' }).json(body);
}

function sendOAuthError(res: Response, error: unknown) {
  if (error instanceof OAuthError) {
    sendJson(res, error.status, { error: error.error, error_description: error.description });
    return;
  }
  sendJson(res, 500, { error: 'server_error', error_description: 'Erro inesperado.' });
}

/**
 * Lastro como servidor de autorização OAuth 2.1 para apps conectados (ex.: Claude via MCP).
 * Descoberta (RFC 8414 / RFC 9728), registro dinâmico (RFC 7591), authorize com consentimento
 * na tela do Lastro, token com PKCE e refresh rotativo, revogação (RFC 7009).
 */
@ApiTags('apps')
@Controller()
export class AppOAuthController {
  constructor(private readonly oauth: AppOAuthService) {}

  @Public()
  @Get('oauth/metadata')
  @ApiExcludeEndpoint()
  metadata(@Res() res: Response) {
    sendJson(res, 200, this.oauth.authorizationServerMetadata());
  }

  @Public()
  @Get('oauth/protected-resource')
  @ApiExcludeEndpoint()
  protectedResource(@Res() res: Response) {
    sendJson(res, 200, this.oauth.protectedResourceMetadata());
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @Post('oauth/register')
  @ApiExcludeEndpoint()
  async register(@Body() body: unknown, @Res() res: Response) {
    try {
      sendJson(res, 201, await this.oauth.register(body));
    } catch (error) {
      sendOAuthError(res, error);
    }
  }

  /** Entrada do fluxo: valida e leva a pessoa para a tela de consentimento no frontend. */
  @Public()
  @Get('oauth/authorize')
  @ApiExcludeEndpoint()
  async authorize(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    const query = pickAuthorize(raw);
    const consent = new URL(`${this.oauth.issuer}/conectar`);
    for (const [k, v] of Object.entries(query))
      if (typeof v === 'string') consent.searchParams.set(k, v);
    try {
      const { problem } = await this.oauth.validateAuthorize(toParams(query));
      if (problem) {
        const back = new URL(problem.redirectUri);
        back.searchParams.set('error', problem.error);
        back.searchParams.set('error_description', problem.description);
        if (query.state) back.searchParams.set('state', query.state);
        res.redirect(302, back.toString());
        return;
      }
    } catch (error) {
      // Cliente ou redirect_uri inválidos: nunca redireciona para o cliente; a tela explica.
      consent.search = '';
      consent.searchParams.set(
        'erro',
        error instanceof OAuthError ? error.description : 'Pedido inválido.',
      );
    }
    res.redirect(302, consent.toString());
  }

  /** Dados para a tela de consentimento (pessoa logada no Lastro). */
  @Get('oauth/consent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalhes do app pedindo acesso (tela de consentimento)' })
  async consentDetails(@Query() raw: Record<string, unknown>) {
    const query = pickAuthorize(raw);
    try {
      const { client, redirectUri, problem } = await this.oauth.validateAuthorize(toParams(query));
      return {
        appName: client.name,
        redirectHost: new URL(redirectUri).host,
        valid: problem === null,
        problem: problem?.description ?? null,
      };
    } catch (error) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: error instanceof OAuthError ? error.description : 'Pedido inválido.',
      });
    }
  }

  @Post('oauth/consent')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aprova ou recusa o acesso; devolve a URL de retorno ao app' })
  async consent(@CurrentUser() user: AuthUser, @Body() dto: ConsentDto, @Req() req: Request) {
    try {
      const redirectTo = await this.oauth.decide(
        user.id,
        toParams(dto),
        dto.approve,
        clientContext(req),
      );
      return { redirectTo };
    } catch (error) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        message: error instanceof OAuthError ? error.description : 'Pedido inválido.',
      });
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @Post('oauth/token')
  @ApiExcludeEndpoint()
  async token(@Body() body: Record<string, unknown>, @Res() res: Response) {
    try {
      sendJson(res, 200, await this.oauth.token(body ?? {}));
    } catch (error) {
      sendOAuthError(res, error);
    }
  }

  @Public()
  @Post('oauth/revoke')
  @ApiExcludeEndpoint()
  async revoke(@Body() body: Record<string, unknown>, @Res() res: Response) {
    await this.oauth.revokeToken(body?.token).catch(() => undefined);
    res.status(200).end();
  }

  // -------------------------------------------------------------------------
  // Perfil → Apps conectados

  @Get('apps/connections')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apps com acesso à conta' })
  connections(@CurrentUser() user: AuthUser) {
    return this.oauth.listConnections(user.id);
  }

  @Delete('apps/connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desconecta um app (revoga todos os tokens dele)' })
  async disconnect(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<void> {
    const ok = await this.oauth.revokeConnection(user.id, id, 'user', clientContext(req));
    if (!ok) throw new AppException(ErrorCode.NOT_FOUND);
  }
}
