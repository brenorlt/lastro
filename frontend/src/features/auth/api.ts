import { api, refreshSession } from "@/services/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { ActiveSession, AuthPayload, User } from "@/types/auth";
import type { LoginInput, RegisterInput } from "./schemas";

const pub = { auth: false } as const;

export const authApi = {
  async login(input: LoginInput) {
    const { data } = await api.post<AuthPayload>("/auth/login", input, pub);
    useAuthStore.getState().setSession(data);
    return data;
  },
  register: ({ name, email, password }: RegisterInput) =>
    api.post<{ message: string }>("/auth/register", { name, email, password }, pub),
  verifyEmail: (token: string) => api.post<{ verified: true }>("/auth/verify-email", { token }, pub),
  resendVerification: (email: string) => api.post<{ message: string }>("/auth/resend-verification", { email }, pub),
  forgotPassword: (email: string) => api.post<{ message: string }>("/auth/forgot-password", { email }, pub),
  resetPassword: (token: string, password: string) =>
    api.post<{ reset: true }>("/auth/reset-password", { token, password }, pub),
  refresh: refreshSession,
  async logout() {
    try {
      await api.post<null>("/auth/logout", undefined, pub);
    } finally {
      useAuthStore.getState().clear();
    }
  },
  me: () => api.get<User>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ changed: true }>("/auth/password", { currentPassword, newPassword }),
  sessions: () => api.get<ActiveSession[]>("/auth/sessions"),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${encodeURIComponent(id)}`),
  revokeOtherSessions: () => api.post<{ revoked: number }>("/auth/sessions/revoke-others"),
};
