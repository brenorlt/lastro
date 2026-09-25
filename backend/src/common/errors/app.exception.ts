import { HttpException, type HttpStatus } from '@nestjs/common';
import { ERROR_DEFINITIONS, type ErrorCode } from './error-codes.js';

export interface ErrorDetail {
  field?: string;
  message: string;
  constraint?: string;
}

/**
 * Exceção de domínio padrão da API. Carrega um `code` estável e mensagem pt-BR;
 * o AllExceptionsFilter a converte no envelope de erro.
 *
 * @example throw new AppException(ErrorCode.ACCOUNT_NOT_FOUND);
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      details?: ErrorDetail[];
      status?: HttpStatus;
      cause?: unknown;
    } = {},
  ) {
    const definition = ERROR_DEFINITIONS[code];
    const message = options.message ?? definition.message;
    super(message, options.status ?? definition.status, { cause: options.cause });
    this.code = code;
    this.details = options.details;
  }
}
