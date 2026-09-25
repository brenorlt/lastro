import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { REQUEST_ID_HEADER } from './common/types/http.js';
import { AppConfigService } from './config/app-config.service.js';
import { requestIdMiddleware } from './interceptors/request-id.middleware.js';

export const GLOBAL_PREFIX = 'api';

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
