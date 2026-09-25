"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/#problema", label: "O problema" },
  { href: "/#produto", label: "O produto" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#seguranca", label: "Segurança" },
  { href: "/#planos", label: "Planos" },
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
          <Link href="/cadastro" className={buttonVariants({ variant: "secondary" })}>
            Criar conta
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-principal-mobile"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="text-ink-2 hover:bg-surface-sunken flex size-10 items-center justify-center rounded-md lg:hidden"
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
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
                onClick={() => setOpen(false)}
                className="text-ink-2 hover:bg-surface-sunken hover:text-ink rounded-md px-3 py-2.5 text-sm"
              >
                {l.label}
              </a>
            ))}
            <div className="border-line mt-2 flex flex-col gap-2 border-t pt-4">
              <Link href="/entrar" onClick={() => setOpen(false)} className={buttonVariants({ variant: "secondary" })}>
                Entrar
              </Link>
              <Link href="/cadastro" onClick={() => setOpen(false)} className={buttonVariants()}>
                Criar conta
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
