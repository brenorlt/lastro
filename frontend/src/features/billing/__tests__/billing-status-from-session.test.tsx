import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthPayload, User } from "@/types/auth";
import type { BillingStatus } from "@/types/billing";
import { billingApi, useBillingStatus } from "../api";

const billing: BillingStatus = {
  status: "TRIALING",
  trialEndsAt: "2026-12-02T00:00:00.000Z",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasRecurringSubscription: false,
  planPrice: "25.00",
};

const payload = (extra: Partial<AuthPayload> = {}): AuthPayload => ({
  accessToken: "token",
  expiresIn: 900,
  user: { id: "u1", name: "Teste" } as User,
  ...extra,
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useBillingStatus com a assinatura que veio na sessão", () => {
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.restoreAllMocks();
  });

  it("usa a assinatura da sessão sem chamar GET /billing/status", () => {
    const status = vi.spyOn(billingApi, "status");
    useAuthStore.getState().setSession(payload({ billing }));

    const { result } = renderHook(() => useBillingStatus(), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual(billing);
    expect(status).not.toHaveBeenCalled();
  });

  it("busca no servidor quando a sessão não trouxe a assinatura", () => {
    const status = vi.spyOn(billingApi, "status").mockResolvedValue({ data: billing } as never);
    useAuthStore.getState().setSession(payload({ billing: null }));

    const { result } = renderHook(() => useBillingStatus(), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(status).toHaveBeenCalledTimes(1);
  });
});
