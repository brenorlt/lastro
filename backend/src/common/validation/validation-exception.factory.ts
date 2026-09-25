import type { ValidationError } from 'class-validator';
import { AppException, type ErrorDetail } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';

function flatten(errors: ValidationError[], parent?: string): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([constraint, message]) => ({
      field,
      message: constraint === 'whitelistValidation' ? `O campo ${field} não é permitido` : message,
      constraint,
    }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** Converte erros do class-validator em AppException(VALIDATION_ERROR) com detalhes por campo. */
export function validationExceptionFactory(errors: ValidationError[]): AppException {
  return new AppException(ErrorCode.VALIDATION_ERROR, { details: flatten(errors) });
}
