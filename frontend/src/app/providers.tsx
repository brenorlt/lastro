"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Tooltip } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";

/**
 * Providers da área de produto (app logado, autenticação, admin, onboarding, design system).
 * Fica fora do layout raiz de propósito: a landing não usa react-query, toasts, tooltips nem
 * troca de tema, e carregar tudo isso nela custava dezenas de KB de JS antes do primeiro clique.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
          {children}
          <Toaster />
        </Tooltip.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
