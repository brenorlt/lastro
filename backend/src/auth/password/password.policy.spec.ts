import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from '../dto/auth-requests.dto.js';
import { passwordPolicyViolations } from './password.policy.js';

describe('política de senha', () => {
  it.each(['abcdefghi1', 'senhaForte2026', 'çãoáéíóú12', `${'a'.repeat(127)}1`])(
    'aceita %p',
    (password) => {
      expect(passwordPolicyViolations(password)).toEqual([]);
    },
  );

  it.each([
    ['curta1', 'pelo menos 10'],
    ['somenteletras', 'número'],
    ['1234567890', 'letra'],
    [`${'a'.repeat(128)}1`, 'no máximo 128'],
  ])('rejeita %p', (password, fragment) => {
    expect(passwordPolicyViolations(password).join(' ')).toContain(fragment);
  });

  it('o DTO aplica a mesma política e normaliza o e-mail', () => {
    const ok = plainToInstance(RegisterDto, {
      name: '  Ana  ',
      email: '  Ana@Exemplo.COM ',
      password: 'senhaForte2026',
    });
    expect(validateSync(ok)).toEqual([]);
    expect(ok.email).toBe('ana@exemplo.com');
    expect(ok.name).toBe('Ana');

    const bad = plainToInstance(RegisterDto, { name: 'A', email: 'x', password: 'semnumero!!' });
    const fields = validateSync(bad).map((e) => e.property);
    expect(fields.sort()).toEqual(['email', 'name', 'password']);
  });
});
