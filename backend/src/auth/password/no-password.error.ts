import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

/** Conta criada pelo Google ainda sem senha própria (troca de senha, exclusão de conta). */
export function noPasswordYet(field: string): AppException {
  const message = 'Sua conta ainda não tem senha. Use “Esqueci minha senha” para criar uma.';
  return new AppException(ErrorCode.INVALID_PASSWORD, {
    message,
    details: [{ field, message }],
  });
}
