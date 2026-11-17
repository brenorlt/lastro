import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipBilling } from '../../common/decorators/skip-billing.decorator.js';
import { AppOAuthService } from './app-oauth.service.js';
import { McpToolsFactory } from './mcp-tools.js';

/**
 * Endpoint MCP (Streamable HTTP, sem estado, respostas JSON). A autenticação é o token de
 * app conectado (não o JWT da sessão web): por isso @Public() + validação própria aqui.
 * Assinatura bloqueada não derruba a conexão — as ferramentas explicam como reativar.
 */
@ApiExcludeController()
@Public()
@SkipBilling()
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('mcp')
export class McpController {
  constructor(
    private readonly oauth: AppOAuthService,
    private readonly tools: McpToolsFactory,
  ) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.method !== 'POST') {
      // Sem sessões nem notificações do servidor: GET (stream SSE) e DELETE não se aplicam.
      res
        .status(405)
        .set('Allow', 'POST')
        .json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed.' },
          id: null,
        });
      return;
    }

    const principal = await this.oauth.authenticate(req.headers.authorization);
    if (!principal) {
      res
        .status(401)
        .set(
          'WWW-Authenticate',
          `Bearer realm="lastro", resource_metadata="${this.oauth.resourceMetadataUrl}", scope="financas"`,
        )
        .json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Conecte sua conta Lastro.' },
          id: null,
        });
      return;
    }

    const server = await this.tools.create({
      userId: principal.userId,
      blocked: await this.oauth.isBlocked(principal.userId),
      appUrl: this.oauth.issuer,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
