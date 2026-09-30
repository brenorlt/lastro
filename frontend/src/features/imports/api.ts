import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cardKeys } from "@/features/cards/api";
import { invalidateMoney } from "@/features/transactions/api";
import { api } from "@/services/api-client";
import type { ImportCommitRow, ImportPreview, ImportTarget } from "./types";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_ACCEPT = ".ofx,.qfx,.csv,.txt";

export const importsApi = {
  preview(file: File, target: ImportTarget, invertSigns: boolean) {
    const form = new FormData();
    if (target.accountId) form.append("accountId", target.accountId);
    if (target.creditCardId) form.append("creditCardId", target.creditCardId);
    if (invertSigns) form.append("invertSigns", "true");
    // O arquivo por último: o multer lê os campos de texto antes dele.
    form.append("file", file);
    return api.upload<ImportPreview>("/imports/preview", form);
  },
  commit: (target: ImportTarget, rows: ImportCommitRow[]) =>
    api.post<{ created: number; skipped: number }>("/imports", {
      ...(target.accountId ? { accountId: target.accountId } : { creditCardId: target.creditCardId }),
      rows,
    }),
};

export function useImportPreview() {
  return useMutation({
    mutationFn: (v: { file: File; target: ImportTarget; invertSigns: boolean }) =>
      importsApi.preview(v.file, v.target, v.invertSigns).then((r) => r.data),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { target: ImportTarget; rows: ImportCommitRow[] }) =>
      importsApi.commit(v.target, v.rows).then((r) => r.data),
    onSuccess: () => Promise.all([invalidateMoney(qc), qc.invalidateQueries({ queryKey: cardKeys.all })]),
  });
}
