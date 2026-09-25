import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppException, type ErrorDetail } from '../common/errors/app.exception.js';
import { ERROR_DEFINITIONS, ErrorCode, errorCodeFromStatus } from '../common/errors/error-codes.js';
import { type AppRequest, type ErrorResponse, REQUEST_ID_HEADER } from '../common/types/http.js';
import { AppConfigService } from '../config/app-config.service.js';

interface NormalizedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

interface PrismaKnownErrorLike {
  name: 'PrismaClientKnownRequestError';
  code: string;
  meta?: Record<string, unknown>;
}

interface HttpParserErrorLike {
  type: string;
  status: number;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownErrorLike {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function isPrismaUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.name === 'PrismaClientInitializationError';
}

/** Erros do body-parser (JSON malformado, corpo grande demais) chegam como Error com `type`. */
function isHttpParserError(error: unknown): error is HttpParserErrorLike {
  return (
    error instanceof Error &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

/**
 * Extrai os campos do índice único violado. Com driver adapter (pg) o Prisma 7 às vezes só
 * informa o nome do índice; nesse caso não há detalhes — serviços devem capturar P2002 e
 * lançar um código de domínio (ex.: EMAIL_ALREADY_IN_USE).
 */
function uniqueTargetFields(meta: Record<string, unknown> | undefined): string[] {
  const target = meta?.target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === 'string');
  if (typeof target === 'string') return [target];

  const adapterError = meta?.driverAdapterError as
    { cause?: { constraint?: { fields?: unknown } } } | undefined;
  const fields = adapterError?.cause?.constraint?.fields;
  return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<AppRequest>();
    const response = ctx.getResponse<Response>();

    const requestId = this.resolveRequestId(request);
    const normalized = this.normalize(exception);

    // Só em development/test expomos a mensagem interna (nunca o stack) para depuração.
    if (
      normalized.status >= 500 &&
      !this.config.isProductionLike &&
      exception instanceof Error &&
      !(exception instanceof HttpException)
    ) {
      normalized.details = [{ message: exception.message, constraint: 'internal' }];
    }

    if (normalized.status >= 500) {
      this.logger.error(
        {
          err: exception,
          requestId,
          method: request.method,
          path: request.originalUrl,
        },
        `Erro não tratado: ${exception instanceof Error ? exception.message : String(exception)}`,
      );
    } else if (normalized.code === ErrorCode.CONFLICT || normalized.code === ErrorCode.NOT_FOUND) {
      this.logger.debug({ requestId, code: normalized.code }, normalized.message);
    }

    const body: ErrorResponse = {
      success: false,
      message: normalized.message,
      code: normalized.code,
      statusCode: normalized.status,
      ...(normalized.details?.length ? { details: normalized.details } : {}),
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (!response.headersSent) {
      response.setHeader(REQUEST_ID_HEADER, requestId);
      response.status(normalized.status).json(body);
    }
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof ThrottlerException) {
      return this.fromCode(ErrorCode.RATE_LIMITED);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = errorCodeFromStatus(status);
      // Mensagens padrão do Nest vêm em inglês; exibimos sempre a mensagem pt-BR do código.
      return { status, code, message: ERROR_DEFINITIONS[code].message };
    }

    if (isPrismaKnownError(exception)) {
      return this.fromPrisma(exception);
    }

    if (isPrismaUnavailableError(exception)) {
      return this.fromCode(ErrorCode.SERVICE_UNAVAILABLE);
    }

    if (isHttpParserError(exception)) {
      if (exception.type === 'entity.too.large') return this.fromCode(ErrorCode.PAYLOAD_TOO_LARGE);
      if (exception.status < 500) {
        return { ...this.fromCode(ErrorCode.BAD_REQUEST), message: 'Corpo da requisição inválido' };
      }
    }

    return this.fromCode(ErrorCode.INTERNAL_ERROR);
  }

  private fromPrisma(error: PrismaKnownErrorLike): NormalizedError {
    switch (error.code) {
      case 'P2002': {
        const fields = uniqueTargetFields(error.meta);
        return {
          ...this.fromCode(ErrorCode.CONFLICT),
          message: 'Já existe um registro com esses dados',
          details: fields.map((field) => ({
            field,
            message: 'Valor já utilizado',
            constraint: 'unique',
          })),
        };
      }
      case 'P2025':
        return this.fromCode(ErrorCode.NOT_FOUND);
      case 'P2003':
        return {
          ...this.fromCode(ErrorCode.CONFLICT),
          message: 'Operação viola um relacionamento entre registros',
        };
      case 'P2000':
        return {
          ...this.fromCode(ErrorCode.VALIDATION_ERROR),
          message: 'Valor excede o tamanho permitido',
        };
      default:
        return this.fromCode(ErrorCode.INTERNAL_ERROR);
    }
  }

  private fromCode(code: ErrorCode): NormalizedError {
    const definition = ERROR_DEFINITIONS[code];
    return { status: definition.status, code, message: definition.message };
  }

  private resolveRequestId(request: AppRequest): string {
    const header = request.headers?.[REQUEST_ID_HEADER];
    return typeof header === 'string' && header.length > 0 ? header : randomUUID();
  }
}
