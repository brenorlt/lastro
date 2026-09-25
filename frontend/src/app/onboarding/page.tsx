import type { Metadata } from "next";
import { SessionGate } from "@/features/auth/components/session-gate";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Primeiros passos", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <SessionGate>
      <OnboardingWizard />
    </SessionGate>
  );
}
