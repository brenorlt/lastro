import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UiState {
  /** Oculta valores monetários na tela (uso em público). */
  privacyMode: boolean;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  /** Pessoa fechou o card "Primeiros passos" do painel. */
  setupDismissed: boolean;
  dismissSetup: () => void;
  togglePrivacy: () => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      privacyMode: false,
      sidebarCollapsed: false,
      commandOpen: false,
      setupDismissed: false,
      dismissSetup: () => set({ setupDismissed: true }),
      togglePrivacy: () => set((s) => ({ privacyMode: !s.privacyMode })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: "lastro-ui",
      storage: createJSONStorage(() => window.localStorage),
      partialize: ({ privacyMode, sidebarCollapsed, setupDismissed }) => ({ privacyMode, sidebarCollapsed, setupDismissed }),
      // Reidratado no AppShell após montar, evitando divergência de hidratação.
      skipHydration: true,
    },
  ),
);
