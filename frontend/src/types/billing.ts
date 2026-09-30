export type BillingStatusValue = "TRIALING" | "ACTIVE" | "BLOCKED" | "CANCELLED";

export interface BillingStatus {
  status: BillingStatusValue;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasRecurringSubscription: boolean;
  planPrice: string;
}

export interface PixCheckout {
  id: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
}

export interface BoletoCheckout {
  id: string;
  barCode: string;
  url: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
}

export interface HostedCheckout {
  url: string;
}
