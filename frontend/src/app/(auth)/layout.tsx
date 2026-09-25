import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Painel de marca sempre escuro: a classe .dark reescopa os tokens. */}
      <aside className="dark relative hidden overflow-hidden bg-canvas p-12 text-ink lg:flex lg:flex-col">
        <Link href="/" aria-label="Lastro — página inicial">
          <Logo />
        </Link>
        <div className="mt-auto max-w-md">
          <p className="font-display text-4xl leading-[1.1] tracking-[-0.02em]">
            Clareza hoje.
            <br />
            <span className="italic text-brass">Patrimônio amanhã.</span>
          </p>
          <div aria-hidden className="mt-10 h-px w-full bg-linear-to-r from-brass via-brass/40 to-transparent" />
          <p className="mt-6 text-sm leading-relaxed text-ink-2">
            Seus dados trafegam criptografados, sua senha nunca é armazenada em texto e cada sessão pode ser encerrada a
            qualquer momento.
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
  );
}
