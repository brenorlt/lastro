"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useComposer } from "@/stores/composer-store";
import type { Transaction } from "@/types/finance";

/** Abre um lançamento no lugar certo: pagamentos de fatura vivem na tela do cartão. */
export function useOpenTransaction() {
  const router = useRouter();
  const openEdit = useComposer((s) => s.openEdit);
  return useCallback(
    (t: Transaction) => {
      if (t.type === "TRANSFER" && t.creditCard) return router.push(`/cartoes/${t.creditCard.id}`);
      // Transferências de um lado só são geradas por investimentos ou dívidas e se editam lá.
      if (t.type === "TRANSFER" && (!t.account || !t.transferAccount)) {
        return router.push(t.description.startsWith("Pagamento:") ? "/patrimonio" : "/investimentos");
      }
      openEdit(t);
    },
    [router, openEdit],
  );
}
