import type { Metadata } from "next";
import { InvestmentsView } from "@/features/investments/components/investments-view";

export const metadata: Metadata = { title: "Investimentos" };

export default function InvestmentsPage() {
  return <InvestmentsView />;
}
