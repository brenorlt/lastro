import type { Metadata } from "next";
import { BillingView } from "@/features/billing/components/billing-view";

export const metadata: Metadata = { title: "Plano e cobrança" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?pago=1: retorno do checkout hospedado de cartão da AbacatePay (completionUrl).
  const { pago } = await searchParams;
  return <BillingView returnedFromCheckout={pago === "1"} />;
}
