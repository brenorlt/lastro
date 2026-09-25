import type { Metadata } from "next";
import { CardDetailView } from "@/features/cards/components/card-detail-view";

export const metadata: Metadata = { title: "Cartão" };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CardDetailView id={id} />;
}
