"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { SIGNUP_CTA } from "../data";

const LINKS = [
  { href: "/#produto", label: "Produto" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#comparativo", label: "Comparativo" },
  { href: "/#seguranca", label: "Segurança" },
  { href: "/#planos", label: "Preço" },
  { href: "/#faq", label: "Perguntas" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="border-line/70 bg-canvas/80 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Lastro — início">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-nav="header"
              className="text-ink-2 hover:bg-surface-sunken hover:text-ink rounded-md px-3 py-2 text-sm transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-1 lg:flex">
          <Link href="/entrar" className={buttonVariants({ variant: "ghost" })}>
            Entrar
          </Link>
          <Link href="/cadastro" data-cta="header" className={buttonVariants()}>
            Testar grátis
          </Link>
        </div>
        {/* O header é sticky: no celular este é o único CTA sempre à vista durante a rolagem. */}
        <div className="flex items-center gap-1 lg:hidden">
          <Link href="/cadastro" data-cta="header-mobile" className={buttonVariants({ size: "sm" })}>
            Testar grátis
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-principal-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="text-ink-2 hover:bg-surface-sunken flex size-10 items-center justify-center rounded-md"
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
      {/* grid-rows 0fr→1fr anima até a altura real do conteúdo, sem limite fixo que corte itens. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out lg:hidden",
          open ? "border-line grid-rows-[1fr] border-t" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <nav id="menu-principal-mobile" aria-label="Principal" className="flex flex-col gap-1 px-5 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                data-nav="menu-mobile"
                onClick={() => setOpen(false)}
                className="text-ink-2 hover:bg-surface-sunken hover:text-ink rounded-md px-3 py-2.5 text-sm"
              >
                {l.label}
              </a>
            ))}
            <div className="border-line mt-2 flex flex-col gap-2 border-t pt-4">
              <Link href="/cadastro" data-cta="menu-mobile" onClick={() => setOpen(false)} className={buttonVariants()}>
                {SIGNUP_CTA}
              </Link>
              <Link href="/entrar" onClick={() => setOpen(false)} className={buttonVariants({ variant: "secondary" })}>
                Entrar
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
