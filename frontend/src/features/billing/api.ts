import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { BillingStatus, BoletoCheckout, PixCheckout } from "@/types/billing";

export const billingKeys = { status: ["billing-status"] as const };

export const billingApi = {
  status: () => api.get<BillingStatus>("/billing/status"),
  checkoutPix: () => api.post<PixCheckout>("/billing/checkout/pix"),
  checkoutBoleto: () => api.post<BoletoCheckout>("/billing/checkout/boleto"),
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
  return useMutation({ mutationFn: async () => (await billingApi.checkoutBoleto()).data });
}
