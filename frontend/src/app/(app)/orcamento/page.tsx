import type { Metadata } from "next";
import { BudgetsView } from "@/features/budgets/components/budgets-view";

export const metadata: Metadata = { title: "Orçamento" };

export default function BudgetPage() {
  return <BudgetsView />;
}
