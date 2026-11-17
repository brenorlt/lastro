import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";

/** Parâmetros OAuth repassados do /api/oauth/authorize para a tela de consentimento. */
export const AUTHORIZE_KEYS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "state",
  "resource",
] as const;
export type AuthorizeParams = Partial<Record<(typeof AUTHORIZE_KEYS)[number], string>>;

export interface ConsentDetails {
  appName: string;
  redirectHost: string;
  valid: boolean;
  problem: string | null;
}

export interface AppConnection {
  id: string;
  appName: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const connectionsKey = ["apps", "connections"] as const;

export function useConsentDetails(params: AuthorizeParams, enabled: boolean) {
  return useQuery({
    queryKey: ["oauth", "consent", params],
    queryFn: async () => (await api.get<ConsentDetails>("/oauth/consent", { query: params })).data,
    enabled,
    retry: false,
  });
}

export function useDecide() {
  return useMutation({
    mutationFn: async (input: AuthorizeParams & { approve: boolean }) =>
      (await api.post<{ redirectTo: string }>("/oauth/consent", input)).data,
  });
}

export function useConnections() {
  return useQuery({ queryKey: connectionsKey, queryFn: async () => (await api.get<AppConnection[]>("/apps/connections")).data });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/apps/connections/${id}`),
    onSuccess: () => {
      toast.success("App desconectado", { description: "Ele não consegue mais acessar sua conta." });
      return qc.invalidateQueries({ queryKey: connectionsKey });
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

/** Endereço que a pessoa cola no Claude para adicionar o conector. */
export function mcpServerUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const origin = typeof window !== "undefined" ? window.location.origin : site ?? "";
  return `${origin}/api/mcp`;
}
