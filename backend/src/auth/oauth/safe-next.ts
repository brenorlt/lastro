const INTERNAL = 'http://internal.invalid';

/**
 * Aceita só caminhos internos para o destino pós-login (evita open redirect: "//evil.com",
 * "https://evil.com", "/\\evil.com"). Mesma regra de frontend/src/lib/safe-redirect.ts.
 */
export function safeNext(target: unknown): string | null {
  if (typeof target !== 'string' || target.length > 512) return null;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return null;
  try {
    const url = new URL(target, INTERNAL);
    if (url.origin !== INTERNAL) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
