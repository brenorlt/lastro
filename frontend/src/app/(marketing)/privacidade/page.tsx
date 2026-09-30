import type { Metadata } from "next";
import { CookiePreferences } from "@/components/analytics/cookie-preferences";
import { LegalPage } from "@/features/marketing/components/legal-page";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updated="setembro de 2026">
      <h2>Quais dados guardamos</h2>
      <p>Nome, e-mail, telefone e foto (opcionais, exceto nome e e-mail) e as informações financeiras que você mesmo registra: contas, cartões, lançamentos, metas, reserva, investimentos, bens e dívidas.</p>
      <h2>O que não fazemos</h2>
      <p>Não nos conectamos à sua conta bancária, não pedimos o número completo dos seus cartões e não vendemos seus dados.</p>
      <h2>Cookies de análise</h2>
      <p>Se você aceitar no aviso de cookies, usamos o Google Analytics para entender quais telas e recursos são usados (por exemplo, &quot;abriu Metas&quot; ou &quot;criou um lançamento&quot;). Enviamos só o nome da tela e da ação e um identificador interno aleatório — nunca valores, descrições, e-mail, nome ou qualquer dado financeiro. Sem aceite, o Google Analytics nem é carregado. <CookiePreferences /></p>
      <h2>Segurança</h2>
      <p>Senhas são guardadas apenas como hash (argon2id). Cada dispositivo conectado aparece em Perfil › Segurança e pode ser desconectado a qualquer momento. Registramos eventos de segurança, como logins e trocas de senha, com IP e navegador.</p>
      <h2>Seus direitos</h2>
      <p>Você pode exportar seus relatórios em CSV e PDF e excluir sua conta a qualquer momento em Perfil. A exclusão apaga definitivamente todos os seus dados financeiros e os registros de segurança associados a você; fica apenas um registro anônimo de que uma exclusão ocorreu, sem nome, e-mail ou IP.</p>
      <h2>Contato</h2>
      <p>
        Dúvidas sobre privacidade ou solicitações relacionadas aos seus dados podem ser enviadas para{" "}
        <a href="mailto:brenotolentino.dev@gmail.com" className="underline">brenotolentino.dev@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
