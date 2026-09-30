import type { Metadata } from "next";
import { GoogleSignUpEvent } from "@/components/analytics/google-sign-up";
import { SessionGate } from "@/features/auth/components/session-gate";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Primeiros passos", robots: { index: false } };

export default function OnboardingPage() {
  return (
    <>
      <GoogleSignUpEvent />
      <SessionGate>
        <OnboardingWizard />
      </SessionGate>
    </>
  );
}
