import { useCallback, useState } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError, userMessage } from "@/services/api-error";

/**
 * Converte erros da API em erros de formulário: campos com `details` viram
 * erros nos inputs; o restante vira uma mensagem no topo do formulário.
 */
export function useApiFormErrors<T extends FieldValues>(setError: UseFormSetError<T>, fields: readonly Path<T>[]) {
  const [formError, setFormError] = useState<{ code: string; message: string } | null>(null);

  const handle = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.fields.length) {
        let mapped = false;
        for (const f of error.fields) {
          if ((fields as readonly string[]).includes(f.field)) {
            setError(f.field as Path<T>, { type: "server", message: f.message });
            mapped = true;
          }
        }
        if (mapped) return setFormError(null);
      }
      setFormError({ code: error instanceof ApiError ? error.code : "INTERNAL_ERROR", message: userMessage(error) });
    },
    [fields, setError],
  );

  return { formError, setFormError, handle };
}
