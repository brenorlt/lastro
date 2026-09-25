import { create } from "zustand";
import type { Transaction } from "@/types/finance";

export type ComposerMode = "EXPENSE" | "INCOME" | "TRANSFER";

interface ComposerState {
  open: boolean;
  mode: ComposerMode;
  editing: Transaction | null;
  /** Conta pré-selecionada (ex.: aberto a partir da tela de contas). */
  accountId: string | null;
  creditCardId: string | null;
  openNew: (mode?: ComposerMode, accountId?: string | null, creditCardId?: string | null) => void;
  openEdit: (t: Transaction) => void;
  close: () => void;
}

/** Compositor global de lançamentos: abre de qualquer tela (botão, atalho N, ⌘K). */
export const useComposer = create<ComposerState>()((set) => ({
  open: false,
  mode: "EXPENSE",
  editing: null,
  accountId: null,
  creditCardId: null,
  openNew: (mode = "EXPENSE", accountId = null, creditCardId = null) => set({ open: true, mode, editing: null, accountId, creditCardId }),
  openEdit: (t) => set({ open: true, mode: t.type, editing: t, accountId: null, creditCardId: null }),
  close: () => set({ open: false }),
}));
