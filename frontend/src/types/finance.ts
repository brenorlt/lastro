export type AccountType = "CHECKING" | "SAVINGS" | "DIGITAL" | "WALLET" | "INVESTMENT" | "OTHER";
export type AccountStatus = "ACTIVE" | "ARCHIVED";

export interface Account {
  id: string;
  name: string;
  institution: string | null;
  type: AccountType;
  /** Decimal em string, ex.: "1520.40". */
  initialBalance: string;
  currentBalance: string;
  color: string;
  icon: string;
  status: AccountStatus;
  includeInNetWorth: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsMeta {
  totalBalance: string;
  count: number;
  byType: Partial<Record<AccountType, string>>;
}

export interface AccountInput {
  name: string;
  institution?: string | null;
  type: AccountType;
  initialBalance: string;
  color: string;
  icon: string;
  includeInNetWorth?: boolean;
}

export type CategoryType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  parentId: string | null;
  isDefault: boolean;
  children?: Category[];
  transactionCount: number;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  parentId?: string | null;
}

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type TransactionStatus = "CLEARED" | "PENDING";
export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface EntityRef {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  transactionCount?: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  description: string;
  /** Data sem horário: "YYYY-MM-DD". */
  date: string;
  status: TransactionStatus;
  notes: string | null;
  account: EntityRef | null;
  transferAccount: EntityRef | null;
  category: (EntityRef & { parentId: string | null }) | null;
  tags: Tag[];
  creditCard: { id: string; name: string; color: string; brand: string; lastFourDigits: string | null } | null;
  invoice: { id: string; referenceMonth: string; dueDate: string } | null;
  installment: { groupId: string; number: number; total: number } | null;
  recurring: { id: string; frequency: Frequency; interval: number; endDate: string | null; active: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionTotals {
  income: string;
  expense: string;
  net: string;
  pendingIncome: string;
  pendingExpense: string;
}

export interface TransactionsMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totals: TransactionTotals;
}

export type RepeatInput =
  | { kind: "INSTALLMENTS"; count: number }
  | { kind: "RECURRING"; frequency: Frequency; interval?: number; endDate?: string; autoConfirm?: boolean };

export interface TransactionInput {
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string;
  date: string;
  status?: TransactionStatus;
  /** Exatamente um: conta (débito) ou cartão (crédito). */
  accountId?: string | null;
  creditCardId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  tags?: string[];
  repeat?: RepeatInput;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  date: string;
  description?: string;
  status?: TransactionStatus;
  notes?: string | null;
}

export type SeriesScope = "single" | "future" | "all";

export interface TransactionFilters {
  from: string;
  to: string;
  type?: TransactionType;
  accountId?: string;
  creditCardId?: string;
  categoryId?: string;
  status?: TransactionStatus;
  tagId?: string;
  q?: string;
  sort?: "date" | "amount" | "description";
  order?: "asc" | "desc";
}

export interface SearchResults {
  transactions: Transaction[];
  accounts: Account[];
  categories: Omit<Category, "children" | "transactionCount" | "isDefault">[];
  cards: import("./cards").CreditCard[];
  goals: unknown[];
  investments: import("./wealth").Investment[];
}
