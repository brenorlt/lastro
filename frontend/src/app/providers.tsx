"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Tooltip } from "radix-ui";
import { useState, type ReactNode } from "react";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { Toaster } from "@/components/ui/toaster";

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
          <GoogleAnalytics />
        </Tooltip.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
