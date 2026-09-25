import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/cadastro`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${site}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
