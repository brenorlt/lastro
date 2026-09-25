import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { configureApp } from './app.setup.js';
import { AppConfigService } from './config/app-config.service.js';
import { validateEnv } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  // Fail fast antes de subir o Nest: mensagem limpa, sem stack e sem valores.
  // Variáveis já definidas no ambiente têm precedência sobre o .env.
  if (existsSync('.env')) process.loadEnvFile('.env');
  validateEnv(process.env);

  const { AppModule } = await import('./app.module.js');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
    // Necessário pro webhook da AbacatePay: precisamos do corpo raw pra validar o HMAC.
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get(AppConfigService);
  const port = config.get('PORT');
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Lastro API ouvindo na porta ${port} (${config.nodeEnv})`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
