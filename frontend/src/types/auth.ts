export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

export interface NotificationPrefs {
  channels: { inApp: boolean; email: boolean };
  billsDue: boolean;
  invoiceDue: boolean;
  budgetAlerts: boolean;
  goalReminders: boolean;
  emergencyFund: boolean;
  newTransactions: boolean;
  recurring: boolean;
  weeklySummary: boolean;
}

export type Currency = "BRL" | "USD" | "EUR";
export type Locale = "pt-BR" | "en-US";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  phone: string | null;
  currency: Currency;
  locale: Locale;
  timezone: string;
  theme: ThemePreference;
  onboardingCompleted: boolean;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
}

export interface AuthPayload {
  accessToken: string;
  /** Segundos até expirar. */
  expiresIn: number;
  user: User;
}

export interface ActiveSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}
