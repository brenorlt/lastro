import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

/** Só as páginas públicas são indexáveis; a área logada nunca. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/termos", "/privacidade"], disallow: ["/painel", "/api/", "/design-system"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
