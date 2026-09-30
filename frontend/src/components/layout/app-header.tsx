"use client";

import { Bell, Eye, EyeOff, LogOut, Monitor, Moon, Plus, Search, Shield, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { DropdownMenu as Menu } from "radix-ui";
import { LogoMark } from "@/components/brand/logo";
import { Button, IconButton } from "@/components/ui/button";
import { useUnreadCount } from "@/features/notifications/api";
import { useComposer } from "@/stores/composer-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { useThemePreference } from "@/features/profile/use-theme-preference";
import { cn } from "@/lib/cn";
import type { ThemePreference, UserRole } from "@/types/auth";
import { useUiStore } from "@/stores/ui-store";

const THEMES: { value: ThemePreference; label: string; icon: typeof Monitor }[] = [
  { value: "SYSTEM", label: "Automático (sistema)", icon: Monitor },
  { value: "LIGHT", label: "Claro", icon: Sun },
  { value: "DARK", label: "Escuro", icon: Moon },
];

export function AppHeader({
  user,
}: {
  user: { name: string; email: string; avatarUrl?: string | null; role?: UserRole };
}) {
  const { theme, setTheme } = useThemePreference();
  const privacyMode = useUiStore((s) => s.privacyMode);
  const togglePrivacy = useUiStore((s) => s.togglePrivacy);
  const openCommand = useUiStore((s) => s.setCommandOpen);
  const openNew = useComposer((s) => s.openNew);
  const unread = useUnreadCount().data ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-14 items-center gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/painel" aria-label="Lastro — início" className="md:hidden">
          <LogoMark />
        </Link>

        <button
          type="button"
          onClick={() => openCommand(true)}
          data-tour="search"
          className={cn(
            "ml-auto flex h-9 items-center gap-2.5 rounded-md text-sm text-ink-3 transition-colors md:ml-0",
            "size-9 justify-center hover:bg-surface-sunken md:w-72 md:justify-start md:bg-surface md:px-3 md:ring-1 md:ring-line md:hover:ring-line-strong",
          )}
          aria-label="Buscar (Ctrl ou Cmd + K)"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left md:block">Buscar</span>
          <span className="hidden items-center gap-0.5 md:flex" aria-hidden>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex items-center gap-1 md:ml-auto">
          <Button size="sm" onClick={() => openNew("EXPENSE")} className="mr-2 hidden md:inline-flex" title="Atalho: N" data-tour="new">
            <Plus aria-hidden /> Novo
          </Button>
          <IconButton label={privacyMode ? "Mostrar valores" : "Ocultar valores"} onClick={togglePrivacy} aria-pressed={privacyMode} data-tour="privacy">
            {privacyMode ? <EyeOff /> : <Eye />}
          </IconButton>
          <IconButton label={unread ? `Notificações: ${unread} não lidas` : "Notificações"} asChild>
            <Link href="/notificacoes" className="relative">
              <Bell />
              {unread > 0 && (
                <span aria-hidden className="num absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-semibold leading-none text-ink-inverse">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </IconButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="ml-1 rounded-full" aria-label="Menu da conta">
                <Avatar name={user.name} src={user.avatarUrl} size={32} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                <p className="truncate text-xs text-ink-3">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/perfil">
                  <UserRound aria-hidden /> Perfil e preferências
                </Link>
              </DropdownMenuItem>
              {user.role === "ADMIN" && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield aria-hidden /> Painel admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Aparência</DropdownMenuLabel>
              <Menu.RadioGroup value={theme} onValueChange={(v) => void setTheme(v as ThemePreference)}>
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <Menu.RadioItem
                    key={value}
                    value={value}
                    className="flex h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-sunken data-[state=checked]:font-medium [&_svg]:size-4 [&_svg]:text-ink-3"
                  >
                    <Icon aria-hidden /> {label}
                    <Menu.ItemIndicator className="ml-auto size-1.5 rounded-full bg-accent" />
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/logout">
                  <LogOut aria-hidden /> Sair
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
