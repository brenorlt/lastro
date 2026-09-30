import { create } from "zustand";

interface TourState {
  active: boolean;
  step: number;
  /** Direção da última navegação: passos sem alvo visível são pulados nesse sentido. */
  direction: 1 | -1;
  start: () => void;
  go: (step: number) => void;
  stop: () => void;
}

/** Estado do tour guiado. Em memória: dispara ao concluir o onboarding ou pela busca (⌘K). */
export const useTour = create<TourState>()((set, get) => ({
  active: false,
  step: 0,
  direction: 1,
  start: () => set({ active: true, step: 0, direction: 1 }),
  go: (step) => set({ step, direction: step >= get().step ? 1 : -1 }),
  stop: () => set({ active: false, step: 0 }),
}));
