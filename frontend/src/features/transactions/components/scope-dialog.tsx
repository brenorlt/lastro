"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { OptionCards } from "@/components/ui/pickers";
import type { SeriesScope, Transaction } from "@/types/finance";

interface ScopeDialogProps {
  transaction: Transaction | null;
  action: "edit" | "delete";
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (scope: SeriesScope) => void;
}

/** Para parcelas e recorrências: aplicar só a este, a este e os próximos, ou a todos. */
export function ScopeDialog({ transaction, action, loading, onCancel, onConfirm }: ScopeDialogProps) {
  const [scope, setScope] = useState<SeriesScope>("single");
  if (!transaction) return null;
  const kind = transaction.installment ? "parcelas" : "repetições";
  const verb = action === "edit" ? "Aplicar alterações" : "Excluir";

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent
        title={action === "edit" ? "Alterar lançamento da série" : "Excluir lançamento da série"}
        description={
          transaction.installment
            ? `Parcela ${transaction.installment.number} de ${transaction.installment.total}.`
            : "Este lançamento se repete."
        }
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant={action === "delete" ? "danger" : "primary"} loading={loading} onClick={() => onConfirm(scope)}>
              {verb}
            </Button>
          </>
        }
      >
        <OptionCards<SeriesScope>
          label="Abrangência"
          columns={3}
          value={scope}
          onChange={setScope}
          options={[
            { value: "single", label: "Só este", description: "As outras ficam como estão" },
            { value: "future", label: "Este e próximos", description: `Inclui as ${kind} seguintes` },
            { value: "all", label: "Todos", description: `Todas as ${kind}` },
          ]}
        />
        {action === "edit" && scope !== "single" && (
          <p className="mt-3 text-xs text-ink-3">Data e valor por parcela só mudam neste lançamento; demais campos valem para a série.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
