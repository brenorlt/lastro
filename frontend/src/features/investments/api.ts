import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { api } from "@/services/api-client";
import { userMessage } from "@/services/api-error";
import type { Investment, InvestmentDetail, InvestmentInput, InvestmentsMeta, InvestmentTxType, InvestmentType, Liquidity } from "@/types/wealth";

export const investmentKeys = {
  all: ["investments"] as const,
  list: () => ["investments", "list"] as const,
  detail: (id: string) => ["investments", "detail", id] as const,
  series: () => ["investments", "series"] as const,
};

export const investmentsApi = {
  list: () => api.get<Investment[], InvestmentsMeta>("/investments"),
  detail: (id: string) => api.get<InvestmentDetail>(`/investments/${id}`),
  series: () => api.get<{ month: string; value: string; invested: string; contributions: string }[]>("/investments/series", { query: { months: 12 } }),
  create: (input: InvestmentInput) => api.post<Investment>("/investments", input),
  update: (id: string, input: Partial<InvestmentInput>) => api.patch<Investment>(`/investments/${id}`, input),
  remove: (id: string) => api.delete(`/investments/${id}`),
  addTx: (id: string, input: { type: InvestmentTxType; amount: string; quantity?: string | null; price?: string | null; date: string; note?: string | null; accountId?: string | null }) =>
    api.post<Investment>(`/investments/${id}/transactions`, input),
  removeTx: (id: string, tid: string) => api.delete(`/investments/${id}/transactions/${tid}`),
};

const refresh = (qc: QueryClient) =>
  Promise.all([investmentKeys.all, ["accounts"], ["transactions"], ["dashboard"], ["net-worth"], ["planning"]].map((queryKey) => qc.invalidateQueries({ queryKey })));

export const useInvestments = () => useQuery({ queryKey: investmentKeys.list(), queryFn: () => investmentsApi.list() });
export const useInvestmentSeries = () => useQuery({ queryKey: investmentKeys.series(), queryFn: async () => (await investmentsApi.series()).data });
export const useInvestment = (id: string | null) =>
  useQuery({ queryKey: investmentKeys.detail(id ?? ""), queryFn: async () => (await investmentsApi.detail(id!)).data, enabled: Boolean(id) });

export function useSaveInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: InvestmentInput }) => (id ? investmentsApi.update(id, input) : investmentsApi.create(input)),
    onSuccess: (_r, { id }) => {
      toast.success(id ? "Investimento atualizado" : "Investimento cadastrado");
      return refresh(qc);
    },
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => investmentsApi.remove(id),
    onSuccess: () => {
      toast.success("Investimento removido");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export function useAddInvestmentTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof investmentsApi.addTx>[1] }) => investmentsApi.addTx(id, input),
    onSuccess: (_r, { input }) => {
      toast.success(TX_TYPES.find((t) => t.value === input.type)?.done ?? "Movimentação registrada");
      return refresh(qc);
    },
  });
}

export function useRemoveInvestmentTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tid }: { id: string; tid: string }) => investmentsApi.removeTx(id, tid),
    onSuccess: () => {
      toast.success("Movimentação removida");
      return refresh(qc);
    },
    onError: (err) => toast.error(userMessage(err)),
  });
}

export const INVESTMENT_TYPES: { value: InvestmentType; label: string; group: "Renda fixa" | "Renda variável" | "Outros" }[] = [
  { value: "TREASURY", label: "Tesouro Direto", group: "Renda fixa" },
  { value: "CDB", label: "CDB", group: "Renda fixa" },
  { value: "LCI_LCA", label: "LCI / LCA", group: "Renda fixa" },
  { value: "FIXED_INCOME", label: "Outros de renda fixa", group: "Renda fixa" },
  { value: "STOCKS", label: "Ações", group: "Renda variável" },
  { value: "ETFS", label: "ETFs", group: "Renda variável" },
  { value: "REITS", label: "Fundos imobiliários (FIIs)", group: "Renda variável" },
  { value: "FUNDS", label: "Fundos de investimento", group: "Outros" },
  { value: "PENSION", label: "Previdência", group: "Outros" },
  { value: "CRYPTO", label: "Criptomoedas", group: "Outros" },
  { value: "OTHER", label: "Outro", group: "Outros" },
];

export const investmentTypeLabel = (t: InvestmentType) => INVESTMENT_TYPES.find((x) => x.value === t)?.label ?? t;

export const LIQUIDITY: { value: Liquidity; label: string }[] = [
  { value: "DAILY", label: "Diária" },
  { value: "D_PLUS_X", label: "D+X dias" },
  { value: "ON_MATURITY", label: "No vencimento" },
  { value: "OTHER", label: "Outra" },
];

export const TX_TYPES: { value: InvestmentTxType; label: string; hint: string; done: string; cash: "out" | "in" | null }[] = [
  { value: "BUY", label: "Aporte", hint: "Comprar mais deste ativo", done: "Aporte registrado", cash: "out" },
  { value: "SELL", label: "Resgate", hint: "Vender parte ou tudo", done: "Resgate registrado", cash: "in" },
  { value: "DIVIDEND", label: "Dividendos", hint: "Proventos recebidos", done: "Proventos registrados", cash: "in" },
  { value: "INTEREST", label: "Juros", hint: "Juros ou cupom pago", done: "Juros registrados", cash: "in" },
  { value: "FEE", label: "Taxa", hint: "Custódia, corretagem, IR", done: "Taxa registrada", cash: "out" },
  { value: "VALUATION", label: "Atualizar valor", hint: "Novo valor de mercado total", done: "Valor atualizado", cash: null },
];

/** Paleta categórica em ordem fixa por classe (a cor segue a classe, não a posição). */
export const CLASS_COLORS: Record<InvestmentType, string> = {
  TREASURY: "var(--series-1)",
  CDB: "var(--series-3)",
  LCI_LCA: "var(--series-6)",
  FIXED_INCOME: "var(--series-1)",
  STOCKS: "var(--series-2)",
  ETFS: "var(--series-5)",
  REITS: "var(--series-4)",
  FUNDS: "var(--series-6)",
  PENSION: "var(--series-3)",
  CRYPTO: "var(--series-4)",
  OTHER: "var(--ink-3)",
};
