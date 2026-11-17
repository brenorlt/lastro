import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Providers } from "@/app/providers";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Painel de marca sempre escuro: a classe .dark reescopa os tokens. */}
        <aside className="dark bg-canvas text-ink relative hidden overflow-hidden p-12 lg:flex lg:flex-col">
          <Link href="/" aria-label="Lastro — página inicial">
            <Logo />
          </Link>
          <div className="mt-auto max-w-md">
            <p className="font-display text-4xl leading-[1.1] tracking-[-0.02em]">
              Clareza hoje.
              <br />
              <span className="text-brass italic">Patrimônio amanhã.</span>
            </p>
            <div aria-hidden className="from-brass via-brass/40 mt-10 h-px w-full bg-linear-to-r to-transparent" />
            <p className="text-ink-2 mt-6 text-sm leading-relaxed">
              Seus dados trafegam criptografados, sua senha nunca é armazenada em texto e cada sessão pode ser encerrada
              a qualquer momento.
            </p>
          </div>
        </aside>
        <main className="flex flex-col px-5 py-8 sm:px-10">
          <Link href="/" aria-label="Lastro — página inicial" className="lg:hidden">
            <Logo />
          </Link>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
        </main>
      </div>
    </Providers>
  );
}
