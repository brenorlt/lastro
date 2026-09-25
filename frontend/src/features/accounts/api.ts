import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type { Account, AccountInput, AccountsMeta, AccountStatus, AccountType } from "@/types/finance";

export type StatusFilter = AccountStatus | "ALL";

export const ACCOUNT_TYPES: { value: AccountType; label: string; description: string; icon: string }[] = [
  { value: "CHECKING", label: "Conta corrente", description: "Banco tradicional", icon: "landmark" },
  { value: "DIGITAL", label: "Conta digital", description: "Nubank, Inter, C6…", icon: "smartphone" },
  { value: "SAVINGS", label: "Poupança", description: "Rende automaticamente", icon: "piggy-bank" },
  { value: "WALLET", label: "Carteira", description: "Dinheiro em espécie", icon: "wallet" },
  { value: "INVESTMENT", label: "Investimentos", description: "Saldo em corretora", icon: "trending-up" },
  { value: "OTHER", label: "Outro ativo", description: "Vale, cashback, etc.", icon: "coins" },
];

export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export const accountKeys = {
  all: ["accounts"] as const,
  list: (status: StatusFilter) => ["accounts", "list", status] as const,
};

export const accountsApi = {
  list: (status: StatusFilter) => api.get<Account[], AccountsMeta>("/accounts", { query: { status } }),
  create: (input: AccountInput) => api.post<Account>("/accounts", input),
  update: (id: string, input: Partial<AccountInput>) => api.patch<Account>(`/accounts/${id}`, input),
  archive: (id: string) => api.post<Account>(`/accounts/${id}/archive`),
  unarchive: (id: string) => api.post<Account>(`/accounts/${id}/unarchive`),
  remove: (id: string) => api.delete(`/accounts/${id}`),
};

export function useAccounts(status: StatusFilter) {
  return useQuery({ queryKey: accountKeys.list(status), queryFn: () => accountsApi.list(status) });
}

export function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AccountInput }) =>
      id ? accountsApi.update(id, input) : accountsApi.create(input),
    onSuccess: (_res, { id }) => {
      toast.success(id ? "Conta atualizada" : "Conta criada");
      return Promise.all([qc.invalidateQueries({ queryKey: accountKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
    },
  });
}

type ListCache = Awaited<ReturnType<typeof accountsApi.list>>;

/** Arquivar/desarquivar com UI otimista: o card sai da lista na hora. */
export function useToggleArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (account: Account) =>
      account.status === "ACTIVE" ? accountsApi.archive(account.id) : accountsApi.unarchive(account.id),
    onMutate: async (account) => {
      await qc.cancelQueries({ queryKey: accountKeys.all });
      const snapshots = qc.getQueriesData<ListCache>({ queryKey: accountKeys.all });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        const status = key[2] as StatusFilter;
        if (status === "ALL") continue;
        qc.setQueryData<ListCache>(key, { ...data, data: data.data.filter((a) => a.id !== account.id) });
      }
      return { snapshots };
    },
    onError: (err, _a, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(userMessage(err));
    },
    onSuccess: ({ data }) => toast.success(data.status === "ARCHIVED" ? `“${data.name}” arquivada` : `“${data.name}” reativada`),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: accountKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.remove(id),
    onSuccess: () => {
      toast.success("Conta excluída");
      return Promise.all([qc.invalidateQueries({ queryKey: accountKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
    },
  });
}
