import type { Metadata } from "next";
import { BenefitsSection } from "@/features/marketing/components/benefits-section";
import { DemoSection } from "@/features/marketing/components/demo-section";
import { FaqSection } from "@/features/marketing/components/faq-section";
import { FinalCtaSection } from "@/features/marketing/components/final-cta-section";
import { HeroSection } from "@/features/marketing/components/hero-section";
import { HowItWorksSection } from "@/features/marketing/components/how-it-works-section";
import { PricingSection } from "@/features/marketing/components/pricing-section";
import { ProblemSection } from "@/features/marketing/components/problem-section";
import { SecuritySection } from "@/features/marketing/components/security-section";
import { TransformationSection } from "@/features/marketing/components/transformation-section";

export const metadata: Metadata = {
  title: { absolute: "Lastro — Clareza total sobre o seu dinheiro" },
  description:
    "Gestão financeira pessoal premium: receitas, despesas, cartões, orçamento, metas, reserva, investimentos e patrimônio em uma única visão.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lastro — Clareza total sobre o seu dinheiro",
    description: "Transforme planejamento em patrimônio. Comece seu planejamento financeiro em minutos.",
  },
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <TransformationSection />
      <DemoSection />
      <HowItWorksSection />
      <BenefitsSection />
      <SecuritySection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
