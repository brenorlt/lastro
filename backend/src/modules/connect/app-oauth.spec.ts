import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { isAllowedRedirectUri, pkceMatches } from './app-oauth.service.js';
import { compact } from './mcp-tools.js';

describe('isAllowedRedirectUri', () => {
  it('aceita https e http em loopback', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:6274/oauth/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:33418/callback')).toBe(true);
  });

  it('recusa http público, fragmento, credenciais e esquemas estranhos', () => {
    expect(isAllowedRedirectUri('http://evil.com/cb')).toBe(false);
    expect(isAllowedRedirectUri('https://claude.ai/cb#frag')).toBe(false);
    expect(isAllowedRedirectUri('https://user:pass@claude.ai/cb')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirectUri('não é url')).toBe(false);
  });
});

describe('pkceMatches (S256)', () => {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  it('confere o verifier com o challenge', () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
  });

  it('recusa verifier diferente, curto ou com caracteres inválidos', () => {
    expect(pkceMatches(`${verifier}x`, challenge)).toBe(false);
    expect(pkceMatches('curto', challenge)).toBe(false);
    expect(pkceMatches(`${verifier.slice(0, 50)}+/=`, challenge)).toBe(false);
  });
});

describe('compact (respostas das ferramentas MCP)', () => {
  it('remove nulos, listas vazias e campos visuais/de auditoria; mantém ids e valores', () => {
    const input = {
      id: 'a',
      amount: '10.00',
      icon: 'x',
      color: '#fff',
      createdAt: new Date(),
      notes: null,
      tags: [],
      account: { id: 'b', name: 'Nubank', updatedAt: 'x' },
      when: new Date('2026-11-17T12:00:00Z'),
    };
    expect(compact(input)).toEqual({
      id: 'a',
      amount: '10.00',
      account: { id: 'b', name: 'Nubank' },
      when: '2026-11-17T12:00:00.000Z',
    });
  });
});
