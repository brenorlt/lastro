import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import type { EmergencyFund, EmergencyFundInput } from "@/types/planning";

export const emergencyKeys = { fund: ["emergency-fund"] as const };

export const emergencyApi = {
  get: () => api.get<EmergencyFund | null>("/emergency-fund"),
  save: (input: EmergencyFundInput) => api.put<EmergencyFund>("/emergency-fund", input),
  adjust: (amount: string, note?: string) => api.post<EmergencyFund>("/emergency-fund/adjust", { amount, note }),
};

const refresh = (qc: QueryClient) =>
  Promise.all([qc.invalidateQueries({ queryKey: emergencyKeys.fund }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);

export function useEmergencyFund() {
  return useQuery({ queryKey: emergencyKeys.fund, queryFn: async () => (await emergencyApi.get()).data });
}

export function useSaveEmergencyFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emergencyApi.save,
    onSuccess: () => {
      toast.success("Reserva atualizada");
      return refresh(qc);
    },
  });
}

export function useAdjustEmergencyFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, note }: { amount: string; note?: string }) => emergencyApi.adjust(amount, note),
    onSuccess: (_r, { amount }) => {
      toast.success(amount.startsWith("-") ? "Retirada registrada" : "Valor guardado na reserva");
      return refresh(qc);
    },
  });
}
