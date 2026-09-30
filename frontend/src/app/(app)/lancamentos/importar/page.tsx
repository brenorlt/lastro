import type { Metadata } from "next";
import { ImportView } from "@/features/imports/components/import-view";

export const metadata: Metadata = { title: "Importar extrato" };

export default function ImportStatementPage() {
  return <ImportView />;
}
