import { describe, expect, it } from '@jest/globals';
import {
  formatRefreshToken,
  generateSecret,
  parseRefreshToken,
  safeEqualHex,
  sha256,
} from './token.util.js';

const SESSION_ID = '3f0e5c1a-8b2d-4c6e-9a7f-1b2c3d4e5f60';

describe('token.util', () => {
  it('gera segredos base64url de alta entropia e únicos', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('compara hashes em tempo constante', () => {
    const secret = generateSecret();
    expect(safeEqualHex(sha256(secret), sha256(secret))).toBe(true);
    expect(safeEqualHex(sha256(secret), sha256(`${secret}x`))).toBe(false);
    expect(safeEqualHex(sha256(secret), 'abcd')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });

  it('formata e interpreta refresh tokens <sessionId>.<segredo>', () => {
    const secret = generateSecret();
    const raw = formatRefreshToken(SESSION_ID, secret);
    expect(parseRefreshToken(raw)).toEqual({ sessionId: SESSION_ID, secret });
  });

  it.each([
    undefined,
    '',
    'sem-ponto',
    `nao-uuid.${'a'.repeat(43)}`,
    `${SESSION_ID}.curto`,
    `${SESSION_ID}.${'a'.repeat(43)}!`,
    `${SESSION_ID}.${'a'.repeat(300)}`,
  ])('rejeita token malformado %p', (raw) => {
    expect(parseRefreshToken(raw)).toBeNull();
  });
});
