import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { accountKeys } from "@/features/accounts/api";
import { categoryKeys } from "@/features/categories/api";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type {
  EditInput,
  SearchResults,
  SeriesScope,
  Tag,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionsMeta,
  TransferInput,
} from "@/types/finance";

const PAGE_SIZE = 50;

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (f: TransactionFilters) => ["transactions", "list", f] as const,
  detail: (id: string) => ["transactions", "detail", id] as const,
};

export const transactionsApi = {
  list: (f: TransactionFilters, page: number) =>
    api.get<Transaction[], TransactionsMeta>("/transactions", { query: { ...f, page, pageSize: PAGE_SIZE } }),
  create: (input: TransactionInput) => api.post<Transaction[]>("/transactions", input),
  transfer: (input: TransferInput) => api.post<Transaction>("/transactions/transfers", input),
  update: (id: string, input: EditInput, scope: SeriesScope) =>
    api.patch<Transaction[]>(`/transactions/${id}?scope=${scope}`, input),
  confirm: (id: string) => api.post<Transaction>(`/transactions/${id}/confirm`),
  unconfirm: (id: string) => api.post<Transaction>(`/transactions/${id}/unconfirm`),
  remove: (id: string, scope: SeriesScope) => api.delete(`/transactions/${id}?scope=${scope}`),
  duplicate: (id: string) => api.post<Transaction>(`/transactions/${id}/duplicate`),
  tags: () => api.get<Tag[]>("/tags"),
  search: (q: string, signal?: AbortSignal) => api.get<SearchResults>("/search", { query: { q, limit: 5 }, signal }),
};

/** Lista paginada ("carregar mais"). Totais vêm do meta e cobrem todo o filtro. */
export function useTransactions(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: ({ pageParam }) => transactionsApi.list(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: async () => (await transactionsApi.tags()).data, staleTime: 60_000 });
}

/** Lançamentos mudam saldos de contas e contagens de categorias. */
export function invalidateMoney(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: transactionKeys.all }),
    qc.invalidateQueries({ queryKey: accountKeys.all }),
    qc.invalidateQueries({ queryKey: categoryKeys.all }),
    qc.invalidateQueries({ queryKey: ["tags"] }),
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
    qc.invalidateQueries({ queryKey: ["budgets"] }),
    qc.invalidateQueries({ queryKey: ["notifications"] }),
    qc.invalidateQueries({ queryKey: ["emergency-fund"] }),
  ]);
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: ({ data }) => {
      const first = data[0];
      const label = first?.type === "INCOME" ? "Receita" : "Despesa";
      toast.success(data.length > 1 ? `${data.length} lançamentos criados` : `${label} registrada`, {
        description: first?.description,
      });
      return invalidateMoney(qc);
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.transfer,
    onSuccess: () => {
      toast.success("Transferência registrada");
      return invalidateMoney(qc);
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, scope }: { id: string; input: EditInput; scope: SeriesScope }) => transactionsApi.update(id, input, scope),
    onSuccess: ({ data }) => {
      toast.success(data.length > 1 ? `${data.length} lançamentos atualizados` : "Lançamento atualizado");
      return invalidateMoney(qc);
    },
  });
}

type ListCache = { pages: Awaited<ReturnType<typeof transactionsApi.list>>[]; pageParams: number[] };

/** Marcar como pago/recebido: resposta instantânea na lista, reverte se falhar. */
export function useToggleCleared() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: Transaction) => (t.status === "CLEARED" ? transactionsApi.unconfirm(t.id) : transactionsApi.confirm(t.id)),
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: transactionKeys.all });
      const snapshots = qc.getQueriesData<ListCache>({ queryKey: ["transactions", "list"] });
      const next = t.status === "CLEARED" ? "PENDING" : "CLEARED";
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<ListCache>(key, {
          ...data,
          pages: data.pages.map((p) => ({ ...p, data: p.data.map((x) => (x.id === t.id ? { ...x, status: next } : x)) })),
        });
      }
      return { snapshots };
    },
    onError: (err, _t, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(userMessage(err));
    },
    onSuccess: ({ data }) => toast.success(data.status === "CLEARED" ? (data.type === "INCOME" ? "Marcado como recebido" : "Marcado como pago") : "Marcado como pendente"),
    onSettled: () => invalidateMoney(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: SeriesScope }) => transactionsApi.remove(id, scope),
    onSuccess: (_r, { scope }) => {
      toast.success(scope === "single" ? "Lançamento excluído" : "Lançamentos excluídos");
      return invalidateMoney(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useDuplicateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.duplicate(id),
    onSuccess: () => {
      toast.success("Lançamento duplicado para hoje");
      return invalidateMoney(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export const isSeries = (t: Transaction) => Boolean(t.installment || t.recurring);
