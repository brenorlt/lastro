"use client";

import { ArrowLeft, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/primitives";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-canvas md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav aria-label="Navegação admin" className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-surface text-ink shadow-xs ring-1 ring-line"
                    : "text-ink-2 hover:bg-surface-sunken hover:text-ink",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.75} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <Link
            href="/painel"
            className="flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowLeft className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            Voltar ao app
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line/70 bg-canvas/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 sm:h-16 sm:px-6">
          <div className="md:hidden">
            <Logo />
          </div>
          <span className="hidden text-sm font-medium text-ink-2 md:inline">Painel admin</span>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{user?.name}</p>
              <p className="text-xs text-ink-3">{user?.email}</p>
            </div>
            <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size={32} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
