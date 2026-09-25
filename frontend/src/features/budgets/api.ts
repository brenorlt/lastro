import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type { Budget, BudgetsMeta, BudgetSuggestion } from "@/types/planning";

export const budgetKeys = {
  all: ["budgets"] as const,
  month: (m: string) => ["budgets", m] as const,
  suggestions: (m: string) => ["budgets", "suggestions", m] as const,
};

export const budgetsApi = {
  list: (month: string) => api.get<Budget[], BudgetsMeta>("/budgets", { query: { month } }),
  suggestions: (month: string) => api.get<BudgetSuggestion[]>("/budgets/suggestions", { query: { month } }),
  create: (input: { categoryId: string; month: string; limitAmount: string }) => api.post<Budget>("/budgets", input),
  update: (id: string, limitAmount: string) => api.patch<Budget>(`/budgets/${id}`, { limitAmount }),
  remove: (id: string) => api.delete(`/budgets/${id}`),
  copy: (fromMonth: string, toMonth: string) => api.post<{ created: number; skipped: number }>("/budgets/copy", { fromMonth, toMonth }),
};

const refresh = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: budgetKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);

export function useBudgets(month: string) {
  return useQuery({ queryKey: budgetKeys.month(month), queryFn: () => budgetsApi.list(month), placeholderData: (p) => p });
}

export function useBudgetSuggestions(month: string, enabled = true) {
  return useQuery({ queryKey: budgetKeys.suggestions(month), queryFn: async () => (await budgetsApi.suggestions(month)).data, enabled });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: ({ data }) => {
      toast.success(`Orçamento de ${data.category.name} criado`);
      return refresh(qc);
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, limitAmount }: { id: string; limitAmount: string }) => budgetsApi.update(id, limitAmount),
    onSuccess: () => {
      toast.success("Limite atualizado");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetsApi.remove(id),
    onSuccess: () => {
      toast.success("Orçamento removido");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useCopyBudgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => budgetsApi.copy(from, to),
    onSuccess: ({ data }) => {
      toast.success(data.created ? `${data.created} ${data.created === 1 ? "orçamento copiado" : "orçamentos copiados"}` : "Nada para copiar", {
        description: data.skipped ? `${data.skipped} já existiam neste mês.` : undefined,
      });
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export const LEVEL_COPY = {
  OK: { label: "No controle", tone: "neutral" },
  ATTENTION: { label: "Metade usada", tone: "accent" },
  WARNING: { label: "Perto do limite", tone: "warning" },
  EXCEEDED: { label: "Excedido", tone: "negative" },
} as const;
