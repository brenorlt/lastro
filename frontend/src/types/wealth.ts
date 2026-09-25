export type InvestmentType = "FIXED_INCOME" | "TREASURY" | "CDB" | "LCI_LCA" | "FUNDS" | "STOCKS" | "ETFS" | "REITS" | "CRYPTO" | "PENSION" | "OTHER";
export type Liquidity = "DAILY" | "ON_MATURITY" | "D_PLUS_X" | "OTHER";
export type InvestmentTxType = "BUY" | "SELL" | "DIVIDEND" | "INTEREST" | "FEE" | "VALUATION";

export interface Investment {
  id: string;
  name: string;
  ticker: string | null;
  institution: string | null;
  type: InvestmentType;
  quantity: string | null;
  averagePrice: string | null;
  investedAmount: string;
  currentValue: string;
  income: string;
  realizedGain?: string;
  profit: string;
  profitPercent: number | null;
  appliedAt: string;
  maturityDate: string | null;
  liquidity: Liquidity;
  liquidityDays: number | null;
  notes: string | null;
  allocationPercent: number;
  lastValuationAt: string | null;
  createdAt: string;
}

export interface InvestmentsMeta {
  totalInvested: string;
  totalCurrent: string;
  totalIncome: string;
  profit: string;
  profitPercent: number | null;
  count: number;
  byClass: { type: InvestmentType; current: string; invested: string; share: number }[];
  unallocatedBrokerCash: string;
}

export interface InvestmentTx {
  id: string;
  type: InvestmentTxType;
  quantity: string | null;
  price: string | null;
  amount: string;
  date: string;
  note: string | null;
  account: { id: string; name: string } | null;
}

export interface InvestmentDetail extends Investment {
  transactions: InvestmentTx[];
  series: { month: string; value: string; invested: string }[];
}

export interface InvestmentInput {
  name: string;
  ticker?: string | null;
  institution?: string | null;
  type: InvestmentType;
  quantity?: string | null;
  averagePrice?: string | null;
  investedAmount?: string | null;
  currentValue?: string | null;
  appliedAt: string;
  maturityDate?: string | null;
  liquidity: Liquidity;
  liquidityDays?: number | null;
  notes?: string | null;
  fundingAccountId?: string | null;
}

export type AssetType = "REAL_ESTATE" | "VEHICLE" | "CASH" | "OTHER";
export interface Asset { id: string; name: string; type: AssetType; value: string; acquiredAt: string | null; notes: string | null; updatedAt: string }

export type LiabilityType = "LOAN" | "FINANCING" | "CREDIT_CARD" | "DEBT" | "OTHER";
export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  principal: string;
  outstandingBalance: string;
  interestRate: string | number | null;
  monthlyPayment: string | null;
  dueDay: number | null;
  startDate: string | null;
  endDate: string | null;
  paidPercent: number;
  remainingInstallments: number | null;
  notes: string | null;
}

export interface NetWorthItem { id: string; name: string; value: string; source: "ACCOUNT" | "INVESTMENT" | "ASSET" | "CARD" | "LIABILITY"; href?: string }
export interface NetWorthGroup { key: string; label: string; total: string; items: NetWorthItem[] }
export interface NetWorth {
  netWorth: string;
  assets: { total: string; groups: NetWorthGroup[] };
  liabilities: { total: string; groups: NetWorthGroup[] };
  debtRatio: number | null;
  series: { month: string; assets: string; liabilities: string; netWorth: string }[];
  seriesMethod?: "reconstructed" | "snapshots";
  change12m: { amount: string; percent: number | null } | null;
}

export interface PlanningBaseline {
  netWorth: string;
  investable: string;
  cash: string;
  emergencyFund: { current: string; target: string } | null;
  averageMonthlyIncome: string;
  averageMonthlyExpense: string;
  averageMonthlySurplus: string;
  monthlyDebtPayments: string;
  goals: { id: string; name: string; targetAmount: string; currentAmount: string; targetDate: string | null }[];
  dataQuality: "ACTUAL" | "ONBOARDING" | "NONE";
}
