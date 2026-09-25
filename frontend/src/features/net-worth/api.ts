import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import type { Asset, AssetType, Liability, LiabilityType, NetWorth, PlanningBaseline } from "@/types/wealth";
import type { Assumptions } from "@/features/planning/projection";

const refresh = (qc: QueryClient) =>
  Promise.all([["net-worth"], ["assets"], ["liabilities"], ["dashboard"], ["planning"], ["accounts"], ["transactions"]].map((queryKey) => qc.invalidateQueries({ queryKey })));

export const useNetWorth = () => useQuery({ queryKey: ["net-worth"], queryFn: async () => (await api.get<NetWorth>("/net-worth")).data });
export const useAssets = () => useQuery({ queryKey: ["assets"], queryFn: async () => (await api.get<Asset[]>("/assets")).data });
export const useLiabilities = () => useQuery({ queryKey: ["liabilities"], queryFn: async () => (await api.get<Liability[]>("/liabilities")).data });

export type AssetInput = { name: string; type: AssetType; value: string; acquiredAt?: string | null; notes?: string | null };
export type LiabilityInput = {
  name: string;
  type: LiabilityType;
  principal: string;
  outstandingBalance: string;
  interestRate?: string | null;
  monthlyPayment?: string | null;
  dueDay?: number | null;
  endDate?: string | null;
  notes?: string | null;
};

export function useSaveAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AssetInput }) => (id ? api.patch<Asset>(`/assets/${id}`, input) : api.post<Asset>("/assets", input)),
    onSuccess: (_r, { id }) => { toast.success(id ? "Bem atualizado" : "Bem adicionado"); return refresh(qc); },
  });
}

export function useSaveLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LiabilityInput }) => (id ? api.patch<Liability>(`/liabilities/${id}`, input) : api.post<Liability>("/liabilities", input)),
    onSuccess: (_r, { id }) => { toast.success(id ? "Dívida atualizada" : "Dívida adicionada"); return refresh(qc); },
  });
}

export function useDeleteWealthItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: "assets" | "liabilities"; id: string }) => api.delete(`/${kind}/${id}`),
    onSuccess: () => { toast.success("Item removido"); return refresh(qc); },
  });
}

export function usePayLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { amount: string; date: string; accountId?: string | null } }) => api.post<Liability>(`/liabilities/${id}/payments`, input),
    onSuccess: () => { toast.success("Pagamento registrado"); return refresh(qc); },
  });
}

export const usePlanningBaseline = () => useQuery({ queryKey: ["planning", "baseline"], queryFn: async () => (await api.get<PlanningBaseline>("/planning/baseline")).data });
export const usePlanningAssumptions = () =>
  useQuery({ queryKey: ["planning", "assumptions"], queryFn: async () => (await api.get<Assumptions>("/planning/assumptions")).data, staleTime: Infinity });
export const saveAssumptions = (a: Assumptions) => api.put<Assumptions>("/planning/assumptions", a);

export const ASSET_TYPES: { value: AssetType; label: string; icon: string }[] = [
  { value: "REAL_ESTATE", label: "Imóvel", icon: "house" },
  { value: "VEHICLE", label: "Veículo", icon: "car" },
  { value: "CASH", label: "Dinheiro guardado", icon: "banknote" },
  { value: "OTHER", label: "Outro bem", icon: "gift" },
];

export const LIABILITY_TYPES: { value: LiabilityType; label: string }[] = [
  { value: "FINANCING", label: "Financiamento" },
  { value: "LOAN", label: "Empréstimo" },
  { value: "DEBT", label: "Dívida" },
  { value: "OTHER", label: "Outro" },
];
