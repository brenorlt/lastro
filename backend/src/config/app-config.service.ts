import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Acesso tipado às variáveis de ambiente já validadas pelo schema zod. */
@Injectable()
export class AppConfigService {
  readonly version = readPackageVersion();

  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  /** Ambientes em que detalhes internos jamais podem vazar para o cliente. */
  get isProductionLike(): boolean {
    return this.nodeEnv === 'production' || this.nodeEnv === 'staging';
  }

  get swaggerEnabled(): boolean {
    return this.nodeEnv !== 'production' || this.get('SWAGGER_ENABLED');
  }
}
