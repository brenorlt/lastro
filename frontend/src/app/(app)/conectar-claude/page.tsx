import type { Metadata } from "next";
import { ClaudeGuideView } from "@/features/connect/components/claude-guide-view";

export const metadata: Metadata = { title: "Use o Lastro pelo Claude" };

export default function ClaudeGuidePage() {
  return <ClaudeGuideView />;
}
