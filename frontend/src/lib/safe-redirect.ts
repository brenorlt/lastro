const FALLBACK = "/painel";

/**
 * Aceita apenas caminhos internos para o parâmetro ?next=, evitando open redirect
 * (ex.: "//evil.com", "https://evil.com", "/\\evil.com").
 */
export function safeRedirect(target: string | null | undefined, fallback = FALLBACK): string {
  if (!target || typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  try {
    const url = new URL(target, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
