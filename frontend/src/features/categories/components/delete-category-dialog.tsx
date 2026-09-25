"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { userMessage } from "@/services/api-error";
import type { Category } from "@/types/finance";
import { totalUsage, useDeleteCategory } from "../api";

interface Props {
  category: Category | null;
  /** Todas as categorias do mesmo tipo, em árvore. */
  tree: Category[];
  onOpenChange: (open: boolean) => void;
}

/** Exclusão que nunca deixa lançamentos órfãos: se houver uso, exige escolher o destino. */
export function DeleteCategoryDialog({ category, tree, onOpenChange }: Props) {
  const del = useDeleteCategory();
  const [target, setTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  if (!category) return null;

  const usage = totalUsage(category);
  const blocked = new Set([category.id, ...(category.children ?? []).map((c) => c.id)]);
  const options = tree.flatMap((c) => [c, ...(c.children ?? [])]).filter((c) => !blocked.has(c.id));
  const subs = category.children?.length ?? 0;

  const confirm = async () => {
    setError(null);
    try {
      await del.mutateAsync({ id: category.id, reassignTo: usage > 0 ? target : undefined });
      onOpenChange(false);
      setTarget("");
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { onOpenChange(v); if (!v) { setTarget(""); setError(null); } }}>
      <DialogContent
        title={`Excluir “${category.name}”?`}
        description={subs > 0 ? `As ${subs} subcategorias também serão excluídas.` : undefined}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="danger" loading={del.isPending} disabled={usage > 0 && !target} onClick={() => void confirm()}>
              {usage > 0 ? "Mover e excluir" : "Excluir categoria"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {usage > 0 ? (
            <>
              <p className="text-sm text-ink-2">
                <strong className="font-medium text-ink num">{usage} {usage === 1 ? "lançamento usa" : "lançamentos usam"}</strong> esta categoria.
                Escolha para onde movê-los — nada será perdido. Orçamentos desta categoria serão removidos.
              </p>
              <Field label="Mover lançamentos para">
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {options.map((c) => (
                      <SelectItem key={c.id} value={c.id} leading={<EntityIcon icon={c.icon} color={c.color} size="sm" className="size-6 [&_svg]:size-3.5" />}>
                        {c.parentId ? `↳ ${c.name}` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : (
            <p className="text-sm text-ink-2">Nenhum lançamento usa esta categoria. Você pode recriá-la depois se precisar.</p>
          )}
          {error && <FormAlert>{error}</FormAlert>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
