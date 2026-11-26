import { create } from "zustand";
import type { AuthPayload, User } from "@/types/auth";
import type { BillingStatus } from "@/types/billing";

type Status = "idle" | "loading" | "authenticated" | "anonymous";

interface AuthState {
  status: Status;
  user: User | null;
  /** Access token vive só em memória — nunca em localStorage ou cookie legível. */
  accessToken: string | null;
  expiresAt: number | null;
  /** Assinatura que veio com a sessão: semente de useBillingStatus, poupa um GET /billing/status. */
  billing: BillingStatus | null;
  billingAt: number | null;
  setSession: (payload: AuthPayload) => void;
  setUser: (user: User) => void;
  setStatus: (status: Status) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "idle",
  user: null,
  accessToken: null,
  expiresAt: null,
  billing: null,
  billingAt: null,
  setSession: ({ accessToken, expiresIn, user, billing }) =>
    set({
      accessToken,
      user,
      expiresAt: Date.now() + expiresIn * 1000,
      status: "authenticated",
      ...(billing ? { billing, billingAt: Date.now() } : {}),
    }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () =>
    set({ accessToken: null, expiresAt: null, user: null, billing: null, billingAt: null, status: "anonymous" }),
}));
