import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\p{Nd}/u;

export const PASSWORD_POLICY_DESCRIPTION = `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} caracteres, com pelo menos uma letra e um número`;

/** Lista de violações da política (vazia = senha válida). Espelha a validação do frontend. */
export function passwordPolicyViolations(password: string): string[] {
  const violations: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    violations.push(`A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`);
  }
  if (!HAS_LETTER.test(password)) violations.push('A senha deve conter pelo menos uma letra');
  if (!HAS_DIGIT.test(password)) violations.push('A senha deve conter pelo menos um número');
  return violations;
}

/** Decorator class-validator com a política de senha e mensagens pt-BR. */
export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'A senha deve ser um texto' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`,
    }),
    Matches(HAS_LETTER, { message: 'A senha deve conter pelo menos uma letra' }),
    Matches(HAS_DIGIT, { message: 'A senha deve conter pelo menos um número' }),
  );
}
