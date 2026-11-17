import type { NextConfig } from "next";

// Só é preciso liberar outra origem se NEXT_PUBLIC_API_URL apontar para fora (sem o proxy).
const apiOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.startsWith("/")) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Google Analytics 4 (só carregado após consentimento).
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com${apiOrigin ? ` ${apiOrigin}` : ""}${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // O pacote guarda-chuva "radix-ui" reexporta todos os primitivos: sem isto, importar só o
    // Slot (no Button) levava Accordion, Dialog, DropdownMenu etc. para qualquer página com botão.
    optimizePackageImports: ["radix-ui"],
  },
  // /api/* é atendido por src/app/api/[...path]/route.ts (proxy manual pro backend) — não por
  // um rewrite: o rewrite embutido do Next funde múltiplos Set-Cookie numa resposta só.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
