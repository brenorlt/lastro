"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { MoneyInput } from "@/components/ui/money-input";
import { CategorySelect } from "@/features/transactions/components/entity-selects";
import { formatCurrency } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { Budget, BudgetSuggestion } from "@/types/planning";
import { useCreateBudget, useUpdateBudget } from "../api";

const valid = (v: string) => v !== "" && v !== "invalid" && Number(v) > 0;

export function CreateBudgetDialog({ open, onOpenChange, month, suggestions, preset }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  month: string;
  suggestions: BudgetSuggestion[];
  preset?: { categoryId: string; limit: string } | null;
}) {
  const create = useCreateBudget();
  const [categoryId, setCategoryId] = useState<string | null>(preset?.categoryId ?? null);
  const [limit, setLimit] = useState(preset?.limit ?? "");
  const [error, setError] = useState<string | null>(null);
  const hint = suggestions.find((s) => s.category.id === categoryId);

  const submit = async () => {
    setError(null);
    if (!categoryId) return setError("Escolha uma categoria.");
    if (!valid(limit)) return setError("Informe um limite maior que zero.");
    try {
      await create.mutateAsync({ categoryId, month, limitAmount: limit });
      onOpenChange(false);
    } catch (err) {
      setError(userMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Novo orçamento"
        description="Um limite mensal para uma categoria. Avisamos ao atingir 50%, 80% e 100%."
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button loading={create.isPending} onClick={() => void submit()}>Criar orçamento</Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Categoria" hint="Subcategorias entram no limite da categoria principal.">
            <CategorySelect type="EXPENSE" allowNone={false} value={categoryId} onChange={setCategoryId} />
          </Field>
          <Field label="Limite mensal" hint={hint ? `Você gastou em média ${formatCurrency(hint.averageSpent)}/mês nos últimos 3 meses.` : undefined}>
            <MoneyInput value={limit} onChange={setLimit} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditLimitDialog({ budget, onOpenChange }: { budget: Budget | null; onOpenChange: (v: boolean) => void }) {
  const update = useUpdateBudget();
  const [limit, setLimit] = useState(budget?.limitAmount ?? "");
  if (!budget) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={`Limite de ${budget.category.name}`}
        description={`Gasto até agora: ${formatCurrency(budget.spent)}.`}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button
              loading={update.isPending}
              disabled={!valid(limit)}
              onClick={() => update.mutate({ id: budget.id, limitAmount: limit }, { onSuccess: () => onOpenChange(false) })}
            >
              Salvar limite
            </Button>
          </>
        }
      >
        <Field label="Limite mensal">
          <MoneyInput autoFocus value={limit} onChange={setLimit} />
        </Field>
      </DialogContent>
    </Dialog>
  );
}
