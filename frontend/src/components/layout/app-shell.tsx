"use client";

import { useEffect, type ReactNode } from "react";
import { useApplyUserTheme } from "@/features/profile/use-theme-preference";
import { ProductTour } from "@/features/tour/components/product-tour";
import { TransactionComposer } from "@/features/transactions/components/transaction-composer";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { AppHeader } from "./app-header";
import { CommandMenu } from "./command-menu";
import { MobileTabBar } from "./mobile-nav";
import { QuickAddFab, useQuickAddShortcut } from "./quick-add";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  useApplyUserTheme();
  useQuickAddShortcut();
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-accent px-4 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={{ name: user?.name ?? "", email: user?.email ?? "", avatarUrl: user?.avatarUrl, role: user?.role }}
        />
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 focus:outline-none sm:px-6 sm:pt-8 md:pb-16 lg:px-10 lg:pt-10"
        >
          {children}
        </main>
      </div>
      <MobileTabBar />
      <QuickAddFab />
      <CommandMenu />
      <TransactionComposer />
      <ProductTour />
    </div>
  );
}
