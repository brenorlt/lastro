import type { Metadata } from "next";
import { CardsView } from "@/features/cards/components/cards-view";

export const metadata: Metadata = { title: "Cartões" };

export default function CardsPage() {
  return <CardsView />;
}
