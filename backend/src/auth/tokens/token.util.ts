import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_REGEX = /^[A-Za-z0-9_-]{43,128}$/;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/** Segredo opaco de alta entropia (32 bytes → 43 chars base64url). */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 em hex. Suficiente para segredos aleatórios de alta entropia (não use para senhas). */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Compara dois hashes hex em tempo constante. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export interface ParsedRefreshToken {
  sessionId: string;
  secret: string;
}

/** Refresh token no formato `<sessionId>.<segredo>`: busca por PK, compara o hash do segredo. */
export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(raw: unknown): ParsedRefreshToken | null {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const sessionId = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (!isUuid(sessionId) || !SECRET_REGEX.test(secret)) return null;
  return { sessionId, secret };
}
