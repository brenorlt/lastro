import type { Metadata } from "next";
import { EmergencyView } from "@/features/emergency/components/emergency-view";

export const metadata: Metadata = { title: "Reserva financeira" };

export default function EmergencyPage() {
  return <EmergencyView />;
}
