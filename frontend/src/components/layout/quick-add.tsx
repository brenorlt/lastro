"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useComposer } from "@/stores/composer-store";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox";
}

/** Atalho "N" para novo lançamento (fora de campos de texto e sem modificadores). */
export function useQuickAddShortcut() {
  const openNew = useComposer((s) => s.openNew);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      openNew(e.shiftKey ? "INCOME" : "EXPENSE");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew]);
}

/** Botão flutuante no mobile, acima da tab bar e ao alcance do polegar. */
export function QuickAddFab() {
  const openNew = useComposer((s) => s.openNew);
  const pathname = usePathname();
  // Na importação, a barra fixa de "Importar" ocupa esse espaço.
  if (pathname.startsWith("/lancamentos/importar")) return null;
  return (
    <button
      type="button"
      onClick={() => openNew("EXPENSE")}
      aria-label="Novo lançamento"
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-lg transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-6" strokeWidth={2.2} aria-hidden />
    </button>
  );
}
