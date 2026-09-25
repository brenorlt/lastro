import type { Metadata } from "next";
import { LogoutView } from "@/features/auth/components/logout-view";

export const metadata: Metadata = { title: "Sair", robots: { index: false } };

export default function LogoutPage() {
  return <LogoutView />;
}
