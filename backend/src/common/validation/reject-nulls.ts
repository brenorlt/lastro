import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';

/**
 * PATCH com PartialType aceita `null` (IsOptional); para campos não anuláveis
 * rejeitamos explicitamente em vez de ignorar em silêncio.
 */
export function rejectNulls<T extends object>(dto: T, fields: (keyof T & string)[]): void {
  const offending = fields.filter((field) => dto[field] === null);
  if (offending.length) {
    throw new AppException(ErrorCode.VALIDATION_ERROR, {
      details: offending.map((field) => ({ field, message: 'Este campo não pode ser nulo' })),
    });
  }
}
