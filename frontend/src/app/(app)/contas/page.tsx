import type { Metadata } from "next";
import { AccountsView } from "@/features/accounts/components/accounts-view";

export const metadata: Metadata = { title: "Contas" };

export default function AccountsPage() {
  return <AccountsView />;
}
