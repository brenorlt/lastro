import { create } from "zustand";
import type { AuthPayload, User } from "@/types/auth";

type Status = "idle" | "loading" | "authenticated" | "anonymous";

interface AuthState {
  status: Status;
  user: User | null;
  /** Access token vive só em memória — nunca em localStorage ou cookie legível. */
  accessToken: string | null;
  expiresAt: number | null;
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
  setSession: ({ accessToken, expiresIn, user }) =>
    set({ accessToken, user, expiresAt: Date.now() + expiresIn * 1000, status: "authenticated" }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, expiresAt: null, user: null, status: "anonymous" }),
}));
