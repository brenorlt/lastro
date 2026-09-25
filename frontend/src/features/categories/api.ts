import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import type { Category, CategoryInput, CategoryType } from "@/types/finance";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (type: CategoryType) => ["categories", type] as const,
};

export const categoriesApi = {
  list: (type: CategoryType) => api.get<Category[]>("/categories", { query: { type } }),
  create: (input: CategoryInput) => api.post<Category>("/categories", input),
  update: (id: string, input: Partial<Omit<CategoryInput, "type">>) => api.patch<Category>(`/categories/${id}`, input),
  remove: (id: string, reassignTo?: string) =>
    api.delete(`/categories/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ""}`),
  restoreDefaults: () => api.post<Category[]>("/categories/restore-defaults"),
};

export function useCategories(type: CategoryType) {
  return useQuery({ queryKey: categoryKeys.list(type), queryFn: async () => (await categoriesApi.list(type)).data });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) =>
      id
        ? categoriesApi.update(id, { name: input.name, icon: input.icon, color: input.color, parentId: input.parentId ?? null })
        : categoriesApi.create(input),
    onSuccess: (_r, { id }) => {
      toast.success(id ? "Categoria atualizada" : "Categoria criada");
      return qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) => categoriesApi.remove(id, reassignTo),
    onSuccess: () => {
      toast.success("Categoria excluída");
      return qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useRestoreDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => categoriesApi.restoreDefaults(),
    onSuccess: () => {
      toast.success("Categorias padrão restauradas");
      return qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria").max(40, "Use no máximo 40 caracteres"),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  parentId: z.string().nullable(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

/** Soma de lançamentos da categoria e das subcategorias. */
export const totalUsage = (c: Category) => c.transactionCount + (c.children ?? []).reduce((s, x) => s + x.transactionCount, 0);
