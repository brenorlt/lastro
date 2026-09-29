import type { UserRole } from "./auth";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "BLOCKED" | "CANCELLED";
export type BillingPaymentMethod = "PIX" | "BOLETO";
export type BillingPaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

export interface AdminPayment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  method: BillingPaymentMethod;
  status: BillingPaymentStatus;
  amount: string;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  payments: AdminPayment[];
}

export interface SignupsByDay {
  date: string;
  count: number;
}

export interface AdminOverview {
  totalUsers: number;
  trialingCount: number;
  activeCount: number;
  blockedCount: number;
  cancelledCount: number;
  mrrEstimate: string;
  pendingPayments: number;
  signupsByDay: SignupsByDay[];
  recentPayments: AdminPayment[];
}
