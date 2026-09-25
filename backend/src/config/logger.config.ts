import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../common/types/http.js';
import type { AppConfigService } from './app-config.service.js';

interface SerializedRequest {
  id: unknown;
  method: string;
  url: string;
  remoteAddress?: string;
  headers: Record<string, unknown>;
}

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.accessToken',
  '*.token',
];

export function buildLoggerParams(config: AppConfigService): Params {
  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL'),
      // O requestIdMiddleware já normalizou o header antes deste ponto.
      genReqId: (req: IncomingMessage) => {
        const id = req.headers[REQUEST_ID_HEADER];
        return typeof id === 'string' ? id : randomUUID();
      },
      customProps: () => ({ env: config.nodeEnv }),
      serializers: {
        req: (req: SerializedRequest) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          headers: req.headers,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url?.startsWith('/api/health/live') ?? false,
      },
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
          }
        : undefined,
    },
  };
}
