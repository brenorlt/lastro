import type { LucideIcon } from "lucide-react";
import { Bell, Fingerprint, Lock, ShieldCheck } from "lucide-react";

/** Igual a BILLING_TRIAL_DAYS do backend: todo cadastro começa em teste grátis, sem cartão. */
export const TRIAL_DAYS = 7;

/** Texto dos CTAs principais: a oferta no próprio botão, não só numa legenda. */
export const SIGNUP_CTA = `Testar grátis por ${TRIAL_DAYS} dias`;

export interface Plan {
  key: "completo";
  name: string;
  tagline: string;
  monthlyPrice: number;
  featured?: boolean;
  features: string[];
}

/**
 * Preços e recursos do plano. Nenhum recurso aqui deve existir sem
 * correspondência real no produto — nunca prometa o que ainda não foi construído.
 */
export const PLANS: Plan[] = [
  {
    key: "completo",
    name: "Lastro Completo",
    tagline: "Todos os recursos, um preço único.",
    monthlyPrice: 25,
    featured: true,
    features: [
      "Contas, cartões e categorias ilimitados",
      "Receitas, despesas e transferências",
      "Lançamentos recorrentes e parcelados",
      "Importação de extratos OFX e CSV",
      "Painel com visão do mês",
      "Orçamento por categoria com alertas",
      "Metas com aporte mensal calculado",
      "Reserva de emergência com acompanhamento",
      "Relatórios completos com exportação em CSV e PDF",
      "Notificações de vencimentos e orçamento",
      "Busca global e atalhos de teclado",
      "Investimentos por classe, com rentabilidade",
      "Patrimônio consolidado: ativos e passivos",
      "Projeções em três cenários",
      "Aplicativo web responsivo",
    ],
  },
];

export interface FaqItem { question: string; answer: string }

export const FAQS: FaqItem[] = [
  {
    question: "Como funciona o teste grátis?",
    answer: `Ao criar a conta você usa todos os recursos por ${TRIAL_DAYS} dias, sem cadastrar cartão de crédito. Para continuar depois disso, você assina por R$ 25/mês via Pix, boleto ou cartão. Se não assinar, nada é cobrado.`,
  },
  {
    question: "Meus dados financeiros estão seguros?",
    answer:
      "Sim. Suas senhas nunca são armazenadas em texto simples, sua sessão pode ser encerrada remotamente a qualquer momento em Perfil › Segurança, e toda comunicação com nossos servidores é criptografada.",
  },
  {
    question: "Vocês têm acesso à minha conta bancária?",
    answer:
      "Não. O Lastro não se conecta ao seu banco. Você registra seus lançamentos ou importa o extrato que baixa no app do banco — o controle sobre o que entra nos seus dados é inteiramente seu.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. Não há fidelidade nem multa. E, se quiser sair de vez, você pode excluir sua conta e todos os seus dados a qualquer momento em Perfil.",
  },
  {
    question: "O Lastro promete algum rendimento nos meus investimentos?",
    answer:
      "Não. O Lastro registra e organiza os investimentos que você já possui, mostrando valores e rentabilidade que você mesmo informa. Não somos uma corretora, gestora ou consultoria e não oferecemos recomendações de investimento.",
  },
  {
    question: "Vou ter que digitar todos os meus gastos?",
    answer:
      "Não. Baixe o extrato da conta ou a fatura do cartão em OFX ou CSV no app do seu banco e importe no Lastro: ele sugere a categoria de cada lançamento, aponta possíveis duplicatas e nunca importa a mesma linha duas vezes. Você revisa tudo antes de confirmar — e os lançamentos recorrentes e parcelados se repetem sozinhos.",
  },
  {
    question: "O Lastro cobre cartões de crédito de qualquer banco?",
    answer:
      "Sim. Você cadastra o cartão com o dia de fechamento e vencimento reais, e o Lastro organiza compras, parcelas e faturas automaticamente — de qualquer bandeira ou banco.",
  },
  {
    question: "Como funciona a reserva de emergência?",
    answer:
      "Você informa seu custo de vida mensal e por quantos meses quer se proteger. O Lastro calcula o valor ideal, acompanha o progresso e mostra uma estimativa de quando você deve alcançá-lo.",
  },
  {
    question: "Existe algum recurso que fica de fora do plano?",
    answer:
      "Não. Por R$ 25/mês você tem acesso a todos os recursos do Lastro: contas, cartões, orçamento, metas, reserva, investimentos, patrimônio, projeções e relatórios — sem versões limitadas ou upgrades escondidos.",
  },
];

export interface SecurityPoint { icon: LucideIcon; title: string; description: string }

export const SECURITY_POINTS: SecurityPoint[] = [
  { icon: Lock, title: "Comunicação criptografada", description: "Toda troca de dados entre você e o Lastro acontece por conexão criptografada (HTTPS/TLS)." },
  { icon: Fingerprint, title: "Sessões sob seu controle", description: "Veja todos os dispositivos conectados e encerre qualquer sessão remotamente, a qualquer momento." },
  { icon: ShieldCheck, title: "Senhas nunca em texto simples", description: "Sua senha é protegida com hash criptográfico (argon2id) — nem a nossa equipe tem acesso a ela." },
  { icon: Bell, title: "Proteção contra tentativas", description: "Várias senhas erradas seguidas bloqueiam o acesso temporariamente, e toda atividade de segurança da conta é registrada." },
];
