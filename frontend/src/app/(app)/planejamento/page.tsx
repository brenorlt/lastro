import type { Metadata } from "next";
import { PlanningView } from "@/features/planning/components/planning-view";

export const metadata: Metadata = { title: "Projeções" };

export default function PlanningPage() {
  return <PlanningView />;
}
