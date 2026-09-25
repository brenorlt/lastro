/** Dados ilustrativos usados apenas na página do Design System. Nunca em telas reais. */

export const netWorthSeries = [
  { month: "out", patrimonio: 182400 },
  { month: "nov", patrimonio: 186900 },
  { month: "dez", patrimonio: 184200 },
  { month: "jan", patrimonio: 191300 },
  { month: "fev", patrimonio: 195800 },
  { month: "mar", patrimonio: 199100 },
  { month: "abr", patrimonio: 204600 },
  { month: "mai", patrimonio: 203900 },
  { month: "jun", patrimonio: 210400 },
  { month: "jul", patrimonio: 216800 },
  { month: "ago", patrimonio: 221300 },
  { month: "set", patrimonio: 228750 },
];

export const cashflowSeries = [
  { month: "abr", receitas: 14200, despesas: 9800 },
  { month: "mai", receitas: 14200, despesas: 11350 },
  { month: "jun", receitas: 15900, despesas: 10200 },
  { month: "jul", receitas: 14200, despesas: 9400 },
  { month: "ago", receitas: 14650, despesas: 10900 },
  { month: "set", receitas: 14200, despesas: 9150 },
];

export const spendingByCategory = [
  { id: "moradia", label: "Moradia", value: 3400 },
  { id: "alimentacao", label: "Alimentação", value: 1860 },
  { id: "transporte", label: "Transporte", value: 940 },
  { id: "lazer", label: "Lazer", value: 820 },
  { id: "saude", label: "Saúde", value: 610 },
  { id: "outros", label: "Outros", value: 1520 },
];

export const projectionSeries = [
  { year: "2026", base: 228750, conservador: 228750, otimista: 228750 },
  { year: "2027", base: 292000, conservador: 279000, otimista: 304000 },
  { year: "2028", base: 362000, conservador: 334000, otimista: 391000 },
  { year: "2029", base: 440000, conservador: 393000, otimista: 490000 },
  { year: "2030", base: 526000, conservador: 456000, otimista: 604000 },
  { year: "2031", base: 621000, conservador: 523000, otimista: 734000 },
];

export const budgets = [
  { category: "Alimentação", limit: 1500, used: 1120 },
  { category: "Lazer", limit: 800, used: 820 },
  { category: "Transporte", limit: 1200, used: 540 },
];

export const recentTransactions = [
  { id: "1", description: "Salário", category: "Salário", account: "Conta principal", date: "2026-09-05", amount: 14200, flow: "income" as const },
  { id: "2", description: "Aluguel", category: "Moradia", account: "Conta principal", date: "2026-09-10", amount: 3400, flow: "expense" as const },
  { id: "3", description: "Mercado", category: "Alimentação", account: "Cartão Black", date: "2026-09-18", amount: 412.8, flow: "expense" as const },
  { id: "4", description: "Rendimento CDB", category: "Rendimentos", account: "Investimentos", date: "2026-09-20", amount: 186.4, flow: "income" as const },
];
