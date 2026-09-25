/** Descrição legível do dispositivo a partir do User-Agent (heurística simples, sem dependências). */
export function describeUserAgent(ua: string | null | undefined): { browser: string; os: string; mobile: boolean } {
  if (!ua) return { browser: "Navegador desconhecido", os: "", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|axios|okhttp/i.test(ua)
              ? "Cliente de API"
              : "Navegador";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return { browser, os, mobile: /Mobile|iPhone|Android/.test(ua) };
}
