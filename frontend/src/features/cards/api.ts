import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type { CardBrand, CardInput, CardsMeta, CardStatus, CreditCard, InvoiceDetail, InvoiceStatus, InvoiceSummary } from "@/types/cards";
import type { Transaction } from "@/types/finance";

export const cardKeys = {
  all: ["cards"] as const,
  list: (s: CardStatus | "ALL") => ["cards", "list", s] as const,
  detail: (id: string) => ["cards", "detail", id] as const,
  invoices: (id: string) => ["cards", "invoices", id] as const,
  invoice: (id: string, ref: string) => ["cards", "invoice", id, ref] as const,
  spending: (id: string) => ["cards", "spending", id] as const,
};

export const cardsApi = {
  list: (status: CardStatus | "ALL") => api.get<CreditCard[], CardsMeta>("/cards", { query: { status } }),
  get: (id: string) => api.get<CreditCard>(`/cards/${id}`),
  create: (input: CardInput) => api.post<CreditCard>("/cards", input),
  update: (id: string, input: Partial<CardInput>) => api.patch<CreditCard>(`/cards/${id}`, input),
  archive: (id: string) => api.post<CreditCard>(`/cards/${id}/archive`),
  unarchive: (id: string) => api.post<CreditCard>(`/cards/${id}/unarchive`),
  remove: (id: string) => api.delete(`/cards/${id}`),
  invoices: (id: string) => api.get<InvoiceSummary[]>(`/cards/${id}/invoices`),
  invoice: (id: string, ref: string) => api.get<InvoiceDetail>(`/cards/${id}/invoices/${ref}`),
  pay: (id: string, ref: string, input: { accountId: string; amount?: string; date?: string }) =>
    api.post<{ invoice: InvoiceSummary; payment: Transaction }>(`/cards/${id}/invoices/${ref}/pay`, input),
  spending: (id: string) => api.get<{ referenceMonth: string; total: string }[]>(`/cards/${id}/spending`, { query: { months: 6 } }),
};

/** Cartões afetam saldos (pagamento), lançamentos, painel e orçamentos. */
const refresh = (qc: QueryClient) =>
  Promise.all(
    [cardKeys.all, ["transactions"], ["accounts"], ["dashboard"], ["budgets"]].map((queryKey) => qc.invalidateQueries({ queryKey })),
  );

export function useCards(status: CardStatus | "ALL" = "ACTIVE") {
  return useQuery({ queryKey: cardKeys.list(status), queryFn: () => cardsApi.list(status) });
}

export function useCard(id: string) {
  return useQuery({ queryKey: cardKeys.detail(id), queryFn: async () => (await cardsApi.get(id)).data });
}

export function useInvoices(id: string) {
  return useQuery({ queryKey: cardKeys.invoices(id), queryFn: async () => (await cardsApi.invoices(id)).data });
}

export function useInvoice(id: string, ref: string | null) {
  return useQuery({
    queryKey: cardKeys.invoice(id, ref ?? ""),
    queryFn: async () => (await cardsApi.invoice(id, ref!)).data,
    enabled: Boolean(ref),
    placeholderData: (p) => p,
  });
}

export function useCardSpending(id: string) {
  return useQuery({ queryKey: cardKeys.spending(id), queryFn: async () => (await cardsApi.spending(id)).data });
}

export function useSaveCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CardInput }) => (id ? cardsApi.update(id, input) : cardsApi.create(input)),
    onSuccess: (_r, { id }) => {
      toast.success(id ? "Cartão atualizado" : "Cartão cadastrado");
      return refresh(qc);
    },
  });
}

export function useToggleCardArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: CreditCard) => (c.status === "ARCHIVED" ? cardsApi.unarchive(c.id) : cardsApi.archive(c.id)),
    onSuccess: ({ data }) => {
      toast.success(data.status === "ARCHIVED" ? `“${data.name}” arquivado` : `“${data.name}” reativado`);
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cardsApi.remove(id),
    onSuccess: () => {
      toast.success("Cartão excluído");
      return refresh(qc);
    },
  });
}

export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ref, input }: { id: string; ref: string; input: { accountId: string; amount?: string; date?: string } }) => cardsApi.pay(id, ref, input),
    onSuccess: ({ data }) => {
      toast.success(data.invoice.status === "PAID" ? "Fatura paga" : "Pagamento parcial registrado");
      return refresh(qc);
    },
  });
}

export const BRANDS: { value: CardBrand; label: string }[] = [
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "VISA", label: "Visa" },
  { value: "ELO", label: "Elo" },
  { value: "AMEX", label: "American Express" },
  { value: "HIPERCARD", label: "Hipercard" },
  { value: "OTHER", label: "Outra" },
];

export const brandLabel = (b: string) => BRANDS.find((x) => x.value === b)?.label ?? b;

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: "accent" | "neutral" | "positive" | "negative" | "warning" }> = {
  OPEN: { label: "Aberta", tone: "accent" },
  CLOSED: { label: "Fechada", tone: "warning" },
  PAID: { label: "Paga", tone: "positive" },
  OVERDUE: { label: "Vencida", tone: "negative" },
};
