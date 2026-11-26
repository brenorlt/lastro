import type { Metadata } from "next";
import { AiConnectorSection } from "@/features/marketing/components/ai-connector-section";
import { BankStrip } from "@/features/marketing/components/bank-strip";
import { ComparisonSection } from "@/features/marketing/components/comparison-section";
import { FaqSection } from "@/features/marketing/components/faq-section";
import { FeaturesBento } from "@/features/marketing/components/features-bento";
import { FinalCtaSection } from "@/features/marketing/components/final-cta-section";
import { HeroSection } from "@/features/marketing/components/hero-section";
import { HowItWorksSection } from "@/features/marketing/components/how-it-works-section";
import { PricingSection } from "@/features/marketing/components/pricing-section";
import { ProblemSection } from "@/features/marketing/components/problem-section";
import { SecuritySection } from "@/features/marketing/components/security-section";

const TITLE = "Lastro — Saiba para onde vai cada real";
const DESCRIPTION =
  "Contas, cartões, orçamento, metas, reserva, investimentos e patrimônio numa tela só. Importe o extrato de qualquer banco, sem entregar a senha, e consulte tudo pelo Claude ou pelo Codex. 7 dias grátis, sem cartão.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/**
 * Ordem pensada para conversão: promessa + prova (hero) → compatibilidade (bancos) → dor →
 * produto → IA (conector MCP) → passos → comparação → objeção de segurança → preço → dúvidas → último empurrão.
 * Tudo é Server Component; o único JS da página é header, analytics e consentimento.
 */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BankStrip />
      <ProblemSection />
      <FeaturesBento />
      <AiConnectorSection />
      <HowItWorksSection />
      <ComparisonSection />
      <SecuritySection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
