import type { EntityRef, Transaction } from "./finance";

export type CardBrand = "VISA" | "MASTERCARD" | "ELO" | "AMEX" | "HIPERCARD" | "OTHER";
export type CardStatus = "ACTIVE" | "ARCHIVED" | "BLOCKED";
export type InvoiceStatus = "OPEN" | "CLOSED" | "PAID" | "OVERDUE";

export interface InvoiceSummary {
  id: string | null;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  status: InvoiceStatus;
  total: string;
  paidAmount: string;
  remaining: string;
}

export interface CreditCard {
  id: string;
  name: string;
  institution: string | null;
  brand: CardBrand;
  color: string;
  lastFourDigits: string | null;
  limit: string;
  limitUsed: string;
  availableLimit: string;
  usagePercent: number;
  overLimit: boolean;
  closingDay: number;
  dueDay: number;
  bestPurchaseDay: number;
  status: CardStatus;
  paymentAccount: EntityRef | null;
  currentInvoice: InvoiceSummary | null;
  nextDueInvoice: InvoiceSummary | null;
  createdAt: string;
}

export interface CardsMeta {
  totalLimit: string;
  totalUsed: string;
  totalAvailable: string;
  nextDue: { cardId: string; referenceMonth: string; dueDate: string; remaining: string } | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  transactions: Transaction[];
  payments: Transaction[];
  byCategory: { categoryId: string | null; name: string; color: string; icon: string; amount: string }[];
}

export interface CardInput {
  name: string;
  institution?: string | null;
  brand: CardBrand;
  limit: string;
  closingDay: number;
  dueDay: number;
  color: string;
  lastFourDigits?: string | null;
  paymentAccountId?: string | null;
}
