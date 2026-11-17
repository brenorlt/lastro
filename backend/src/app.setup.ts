import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { REQUEST_ID_HEADER } from './common/types/http.js';
import { AppConfigService } from './config/app-config.service.js';
import { requestIdMiddleware } from './interceptors/request-id.middleware.js';

// helmet: import default/namespace resolve de forma inconsistente entre ambientes (passou
// local, falhou no build da Vercel com "not callable") — o pacote publica tipos ESM/CJS
// duplicados e qual arquivo o TS escolhe sob "nodenext" varia por ambiente. `require` direto
// via createRequire ignora esses tipos publicados; a assinatura é a da própria lib.
type HelmetMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;
type Helmet = (options?: Record<string, unknown>) => HelmetMiddleware;
const helmet = createRequire(import.meta.url)('helmet') as Helmet;

export const GLOBAL_PREFIX = 'api';

function openCors(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version',
  );
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
    );
    res.setHeader('Access-Control-Max-Age', '600');
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
}

/**
 * Configuração HTTP compartilhada entre main.ts e os testes e2e
 * (pipes, guards, filtros e interceptors globais vivem no AppModule).
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfigService);

  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: config.get('BODY_LIMIT') });
  app.useBodyParser('urlencoded', { limit: config.get('BODY_LIMIT'), extended: true });

  // Descoberta OAuth, token e /mcp são chamados por clientes de qualquer origem (Claude,
  // inspetores MCP): CORS aberto, sem credenciais. Registrado antes do CORS restrito do app.
  app.use(
    [
      '/api/oauth/metadata',
      '/api/oauth/protected-resource',
      '/api/oauth/register',
      '/api/oauth/token',
      '/api/oauth/revoke',
      '/api/mcp',
    ],
    openCors,
  );

  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();

  if (config.swaggerEnabled) setupSwagger(app, config);
}

function setupSwagger(app: NestExpressApplication, config: AppConfigService): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Lastro API')
      .setDescription('API REST do Lastro — finanças pessoais.')
      .setVersion(config.version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addCookieAuth('lastro_rt', { type: 'apiKey', in: 'cookie', name: 'lastro_rt' })
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
