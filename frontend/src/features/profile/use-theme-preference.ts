"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/toaster";
import { userMessage } from "@/services/api-error";
import { useAuthStore } from "@/stores/auth-store";
import type { ThemePreference } from "@/types/auth";
import { profileApi } from "./api";

const TO_NEXT: Record<ThemePreference, string> = { SYSTEM: "system", LIGHT: "light", DARK: "dark" };
const FROM_NEXT: Record<string, ThemePreference> = { system: "SYSTEM", light: "LIGHT", dark: "DARK" };

/** Aplica o tema salvo no perfil ao entrar (uma vez por usuário). */
export function useApplyUserTheme() {
  const { setTheme } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const theme = useAuthStore((s) => s.user?.theme);
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !theme || applied.current === userId) return;
    applied.current = userId;
    setTheme(TO_NEXT[theme]);
  }, [userId, theme, setTheme]);
}

/** Troca o tema na hora e persiste no perfil; reverte se a API falhar. */
export function useThemePreference() {
  const { theme, setTheme } = useTheme();
  const current: ThemePreference = FROM_NEXT[theme ?? "system"] ?? "SYSTEM";

  const change = useCallback(
    async (next: ThemePreference) => {
      const previous = current;
      setTheme(TO_NEXT[next]);
      if (!useAuthStore.getState().user) return;
      try {
        await profileApi.update({ theme: next });
      } catch (err) {
        setTheme(TO_NEXT[previous]);
        toast.error(userMessage(err));
      }
    },
    [current, setTheme],
  );

  return { theme: current, setTheme: change };
}
