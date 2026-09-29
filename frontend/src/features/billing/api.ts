import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { BillingStatus, BoletoCheckout, PixCheckout } from "@/types/billing";

export const billingKeys = { status: ["billing-status"] as const };

export const billingApi = {
  status: () => api.get<BillingStatus>("/billing/status"),
  checkoutPix: () => api.post<PixCheckout>("/billing/checkout/pix"),
  checkoutBoleto: (taxId: string) => api.post<BoletoCheckout>("/billing/checkout/boleto", { taxId }),
};

export function useBillingStatus(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: billingKeys.status,
    queryFn: async () => (await billingApi.status()).data,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCheckoutPix() {
  return useMutation({ mutationFn: async () => (await billingApi.checkoutPix()).data });
}

export function useCheckoutBoleto() {
  return useMutation({
    mutationFn: async (taxId: string) => (await billingApi.checkoutBoleto(taxId)).data,
  });
}
