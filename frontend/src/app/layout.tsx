import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
// Mono aparece em poucos detalhes (códigos, extratos): baixa quando for usada, sem disputar o
// carregamento inicial com o título.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap", preload: false });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Lastro — Clareza sobre o seu patrimônio", template: "%s · Lastro" },
  description:
    "Gestão financeira pessoal para quem leva patrimônio a sério: receitas, despesas, metas, reserva, investimentos e planejamento em uma visão só.",
  applicationName: "Lastro",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Lastro" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e2e7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Providers do produto ficam nos layouts de cada área (ver app/providers.tsx). */}
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
