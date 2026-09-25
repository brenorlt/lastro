import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api-client";
import type { BillingStatus, HostedCheckout, PixCheckout } from "@/types/billing";

export const billingKeys = { status: ["billing-status"] as const };

export const billingApi = {
  status: () => api.get<BillingStatus>("/billing/status"),
  checkoutPix: () => api.post<PixCheckout>("/billing/checkout/pix"),
  checkoutCard: () => api.post<HostedCheckout>("/billing/checkout/card"),
  checkoutSubscription: () => api.post<HostedCheckout>("/billing/checkout/subscription"),
  cancelSubscription: () => api.post<null>("/billing/cancel-subscription"),
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

export function useCheckoutCard() {
  return useMutation({ mutationFn: async () => (await billingApi.checkoutCard()).data });
}

export function useCheckoutSubscription() {
  return useMutation({ mutationFn: async () => (await billingApi.checkoutSubscription()).data });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: billingApi.cancelSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.status }),
  });
}
