import type { Metadata } from "next";
import { NetWorthView } from "@/features/net-worth/components/net-worth-view";

export const metadata: Metadata = { title: "Patrimônio" };

export default function NetWorthPage() {
  return <NetWorthView />;
}
