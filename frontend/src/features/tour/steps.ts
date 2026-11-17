import type { Placement } from "./geometry";

export interface TourStep {
  id: string;
  /** Valor de `data-tour` do elemento em destaque. Sem alvo, o card aparece centralizado. */
  target?: string;
  title: string;
  body: string;
  placement?: Placement;
}

/**
 * Tour guiado do painel, exibido logo após o onboarding. Cada alvo pode existir em mais
 * de um lugar (ex.: botão "Novo" no desktop e FAB no mobile) — vale o que estiver visível.
 * Passos cujo alvo não aparece (ex.: painel com erro) são pulados.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Seu painel está pronto",
    body: "Em menos de um minuto mostramos onde fica cada coisa. Use as setas do teclado ou os botões abaixo para avançar.",
  },
  {
    id: "net-worth",
    target: "net-worth",
    title: "Seu patrimônio líquido",
    body: "Tudo o que você tem menos o que deve. A linha de lastro logo abaixo mostra quanto dos seus ativos está livre de dívidas.",
  },
  {
    id: "stats",
    target: "stats",
    title: "Onde está o seu dinheiro",
    body: "Saldo em contas, investimentos, reserva e o que vence nos próximos 30 dias. O ícone ⓘ de cada indicador explica como ele é calculado.",
    placement: "top",
  },
  {
    id: "month",
    target: "month",
    title: "Navegue entre os meses",
    body: "Troque o mês para comparar períodos — o painel inteiro acompanha a sua escolha.",
  },
  {
    id: "insights",
    target: "insights",
    title: "Inteligência financeira",
    body: "Leituras calculadas a partir dos seus próprios lançamentos: taxa de poupança, cobertura da reserva e para onde vai o seu dinheiro.",
  },
  {
    id: "new",
    target: "new",
    title: "Registre um lançamento",
    body: "Receitas, despesas e transferências — únicas, recorrentes ou parceladas. No computador, aperte N a qualquer momento.",
  },
  {
    id: "search",
    target: "search",
    title: "Encontre qualquer coisa",
    body: "Busque lançamentos, contas, categorias e telas. Atalho: ⌘K no Mac ou Ctrl+K no Windows.",
  },
  {
    id: "privacy",
    target: "privacy",
    title: "Modo privacidade",
    body: "Em público? Oculte todos os valores da tela com um clique. As proporções continuam visíveis.",
  },
  {
    id: "nav",
    target: "nav",
    title: "Todas as áreas",
    body: "Contas, cartões, orçamento, metas, reserva, investimentos e relatórios ficam aqui.",
    placement: "right",
  },
  {
    id: "done",
    title: "Tudo pronto",
    body: "Quanto mais lançamentos você registrar, mais precisos ficam os insights. Que tal começar pelo primeiro?",
  },
];
