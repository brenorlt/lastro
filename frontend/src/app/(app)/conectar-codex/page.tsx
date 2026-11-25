import type { Metadata } from "next";
import { CodexGuideView } from "@/features/connect/components/codex-guide-view";

export const metadata: Metadata = { title: "Use o Lastro pelo Codex" };

export default function CodexGuidePage() {
  return <CodexGuideView />;
}
