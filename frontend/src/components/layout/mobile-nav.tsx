"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TABS, sectionSiblings, tabForPath } from "@/config/navigation";
import { cn } from "@/lib/cn";

/** Tab bar inferior (<768px). Abas navegam, nunca executam ações. */
export function MobileTabBar() {
  const pathname = usePathname();
  const current = tabForPath(pathname);
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_TABS.map(({ tab, label, href, icon: Icon }) => {
          const active = current === tab;
          return (
            <li key={tab}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.6} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** No mobile, telas irmãs da mesma aba aparecem como chips roláveis sob o título. */
export function SectionSwitcher() {
  const pathname = usePathname();
  const tab = tabForPath(pathname);
  const siblings = tab ? sectionSiblings(tab) : [];
  if (siblings.length < 2) return null;
  return (
    <nav aria-label="Seções" className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max gap-1.5">
        {siblings.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-full px-3.5 text-xs font-medium",
                  active ? "bg-ink text-ink-inverse" : "bg-surface text-ink-2 ring-1 ring-line",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
