"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !bg-surface-raised !text-ink !ring-1 !ring-line !border-0 !shadow-lg !font-sans",
          description: "!text-ink-2",
          actionButton: "!bg-action !text-action-ink",
          success: "[&_[data-icon]]:!text-positive",
          error: "[&_[data-icon]]:!text-negative",
          warning: "[&_[data-icon]]:!text-warning",
        },
      }}
    />
  );
}
