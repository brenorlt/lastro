import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/components/legal-page";

export const metadata: Metadata = { title: "Termos de uso", alternates: { canonical: "/termos" } };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso" updated="setembro de 2026">
      <h2>O que é o Lastro</h2>
      <p>Uma ferramenta de organização e planejamento financeiro pessoal. Os números exibidos vêm das informações que você registra.</p>
      <h2>O que o Lastro não é</h2>
      <p>O Lastro não é instituição financeira, corretora, gestora ou consultoria de investimentos. Não faz recomendações de investimento, não movimenta dinheiro e não garante rentabilidade ou resultado.</p>
      <h2>Projeções e estimativas</h2>
      <p>Projeções, cenários e prazos estimados são cálculos baseados nas premissas que você define. São referências para planejamento, nunca promessas.</p>
      <h2>Sua conta</h2>
      <p>Você é responsável por manter sua senha em segurança e pela exatidão das informações que registra. Pode encerrar e excluir sua conta a qualquer momento.</p>
    </LegalPage>
  );
}
