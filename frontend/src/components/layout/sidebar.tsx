"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { NAV_GROUPS, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui-store";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150",
        active ? "bg-surface text-ink shadow-xs ring-1 ring-line" : "text-ink-2 hover:bg-surface-sunken hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn("size-[18px] shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")}
        strokeWidth={active ? 2 : 1.75}
        aria-hidden
      />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

/** Sidebar: rail de ícones em tablet (md), completa em desktop (lg+). Oculta no mobile. */
export function Sidebar() {
  const pathname = usePathname();
  const storedCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  const renderNav = (collapsed: boolean) => (
    <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className={cn("px-2.5 pb-1.5 text-2xs font-medium uppercase tracking-[0.08em] text-ink-3", collapsed && "sr-only")}>
            {group.label}
          </p>
          {group.items.map((item) => (
            <SidebarLink key={item.key} item={item} collapsed={collapsed} active={isActive(pathname, item.href)} />
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Tablet: rail fixo */}
      <aside data-tour="nav" className="sticky top-0 hidden h-dvh w-[68px] shrink-0 flex-col border-r border-line bg-canvas md:flex lg:hidden">
        <div className="flex h-16 items-center justify-center">
          <Link href="/painel" aria-label="Lastro — início">
            <LogoMark />
          </Link>
        </div>
        {renderNav(true)}
      </aside>

      {/* Desktop: completa, recolhível */}
      <aside
        data-tour="nav"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-canvas transition-[width] duration-200 ease-out lg:flex",
          storedCollapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center", storedCollapsed ? "justify-center" : "justify-between px-5")}>
          <Link href="/painel" aria-label="Lastro — início">
            {storedCollapsed ? <LogoMark /> : <Logo />}
          </Link>
          {!storedCollapsed && (
            <button
              type="button"
              onClick={toggle}
              className="flex size-8 items-center justify-center rounded-sm text-ink-3 hover:bg-surface-sunken hover:text-ink"
              aria-label="Recolher menu"
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </button>
          )}
        </div>
        {renderNav(storedCollapsed)}
        {storedCollapsed && (
          <div className="flex justify-center p-3">
            <button
              type="button"
              onClick={toggle}
              className="flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-surface-sunken hover:text-ink"
              aria-label="Expandir menu"
            >
              <PanelLeftOpen className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
