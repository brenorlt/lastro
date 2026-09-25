import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type { Goal, GoalCategory, GoalContribution, GoalDetail, GoalInput, GoalStatus } from "@/types/planning";

export type GoalFilter = GoalStatus | "ALL" | "OPEN";

export const goalKeys = {
  all: ["goals"] as const,
  list: (f: GoalFilter) => ["goals", "list", f] as const,
  detail: (id: string) => ["goals", "detail", id] as const,
};

export const goalsApi = {
  list: (status: GoalFilter) =>
    api.get<Goal[], { totalTarget: string; totalSaved: string; count: number }>("/goals", { query: { status: status === "OPEN" ? undefined : status } }),
  detail: (id: string) => api.get<GoalDetail>(`/goals/${id}`),
  create: (input: GoalInput) => api.post<Goal>("/goals", input),
  update: (id: string, input: Partial<GoalInput>) => api.patch<Goal>(`/goals/${id}`, input),
  remove: (id: string) => api.delete(`/goals/${id}`),
  contribute: (id: string, input: { amount: string; date: string; note?: string | null }) =>
    api.post<{ goal: Goal; contribution: GoalContribution }>(`/goals/${id}/contributions`, input),
  removeContribution: (id: string, cid: string) => api.delete<Goal>(`/goals/${id}/contributions/${cid}`),
};

const refresh = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: goalKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);

export function useGoals(filter: GoalFilter) {
  return useQuery({ queryKey: goalKeys.list(filter), queryFn: () => goalsApi.list(filter) });
}

export function useGoal(id: string | null) {
  return useQuery({ queryKey: goalKeys.detail(id ?? ""), queryFn: async () => (await goalsApi.detail(id!)).data, enabled: Boolean(id) });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: GoalInput }) => (id ? goalsApi.update(id, input) : goalsApi.create(input)),
    onSuccess: (_r, { id }) => {
      toast.success(id ? "Meta atualizada" : "Meta criada");
      return refresh(qc);
    },
  });
}

export function useUpdateGoalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: GoalStatus }) => goalsApi.update(id, { status }),
    onSuccess: ({ data }) => {
      toast.success(data.status === "PAUSED" ? "Meta pausada" : data.status === "ARCHIVED" ? "Meta arquivada" : "Meta reativada");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.remove(id),
    onSuccess: () => {
      toast.success("Meta excluída");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useContribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { amount: string; date: string; note?: string | null } }) => goalsApi.contribute(id, input),
    onSuccess: ({ data }) => {
      const withdrawal = data.contribution.amount.startsWith("-");
      toast.success(data.goal.status === "COMPLETED" ? `Meta “${data.goal.name}” concluída!` : withdrawal ? "Resgate registrado" : "Aporte registrado");
      return refresh(qc);
    },
  });
}

export function useRemoveContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cid }: { id: string; cid: string }) => goalsApi.removeContribution(id, cid),
    onSuccess: () => {
      toast.success("Movimentação removida");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export const GOAL_CATEGORIES: { value: GoalCategory; label: string; icon: string; color: string }[] = [
  { value: "TRAVEL", label: "Viagem", icon: "plane", color: "#0EA5E9" },
  { value: "REAL_ESTATE", label: "Imóvel", icon: "house", color: "#F97316" },
  { value: "VEHICLE", label: "Veículo", icon: "car", color: "#3F51D8" },
  { value: "EMERGENCY", label: "Reserva", icon: "shield", color: "#14B8A6" },
  { value: "RETIREMENT", label: "Aposentadoria", icon: "piggy-bank", color: "#A855F7" },
  { value: "FINANCIAL_INDEPENDENCE", label: "Independência financeira", icon: "trending-up", color: "#16A34A" },
  { value: "EQUIPMENT", label: "Equipamento", icon: "laptop", color: "#64748B" },
  { value: "EDUCATION", label: "Educação", icon: "graduation-cap", color: "#6366F1" },
  { value: "OTHER", label: "Outro", icon: "target", color: "#78716C" },
];

export const goalCategoryLabel = (c: GoalCategory) => GOAL_CATEGORIES.find((x) => x.value === c)?.label ?? c;
