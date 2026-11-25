import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CreditCard,
  Gauge,
  Landmark,
  LayoutGrid,
  LineChart,
  MessagesSquare,
  SquareTerminal,
  PiggyBank,
  Scale,
  Shapes,
  Shield,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa de telas do produto — fonte única para sidebar, tab bar mobile,
 * busca global, breadcrumbs e placeholders de fases ainda não implementadas.
 */

export type RouteKey =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "cards"
  | "categories"
  | "budget"
  | "goals"
  | "emergency"
  | "planning"
  | "investments"
  | "netWorth"
  | "reports"
  | "notifications"
  | "claude"
  | "codex"
  | "profile";

export type MobileTab = "home" | "transactions" | "plan" | "wealth" | "reports";

export interface NavItem {
  key: RouteKey;
  label: string;
  href: `/${string}`;
  icon: LucideIcon;
  /** Uma frase: o que a pessoa resolve nesta tela. */
  purpose: string;
  /** Fase do roadmap em que a tela ganha funcionalidade completa. */
  phase: number;
  tab: MobileTab;
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      {
        key: "dashboard",
        label: "Painel",
        href: "/painel",
        icon: LayoutGrid,
        purpose: "Sua vida financeira em uma tela: patrimônio, fluxo do mês e o que merece atenção.",
        phase: 5,
        tab: "home",
        keywords: ["início", "dashboard", "resumo"],
      },
    ],
  },
  {
    label: "Dinheiro",
    items: [
      {
        key: "transactions",
        label: "Lançamentos",
        href: "/lancamentos",
        icon: ArrowLeftRight,
        purpose: "Receitas, despesas e transferências — únicas, recorrentes ou parceladas.",
        phase: 4,
        tab: "transactions",
        keywords: ["transações", "receitas", "despesas", "transferência", "importar", "extrato", "ofx", "csv"],
      },
      {
        key: "accounts",
        label: "Contas",
        href: "/contas",
        icon: Landmark,
        purpose: "Contas correntes, poupança, carteiras e onde seu dinheiro está guardado.",
        phase: 3,
        tab: "wealth",
        keywords: ["banco", "saldo", "carteira"],
      },
      {
        key: "cards",
        label: "Cartões",
        href: "/cartoes",
        icon: CreditCard,
        purpose: "Faturas, limites e parcelamentos de cada cartão de crédito.",
        phase: 7,
        tab: "wealth",
        keywords: ["cartão", "fatura", "limite", "parcelas"],
      },
      {
        key: "categories",
        label: "Categorias",
        href: "/categorias",
        icon: Shapes,
        purpose: "Organize receitas e despesas do seu jeito, com subcategorias.",
        phase: 3,
        tab: "transactions",
      },
    ],
  },
  {
    label: "Planejamento",
    items: [
      {
        key: "budget",
        label: "Orçamento",
        href: "/orcamento",
        icon: Gauge,
        purpose: "Limites mensais por categoria, com alertas antes de ultrapassar.",
        phase: 6,
        tab: "plan",
      },
      {
        key: "goals",
        label: "Metas",
        href: "/metas",
        icon: Target,
        purpose: "Objetivos com valor, prazo e o quanto guardar por mês para chegar lá.",
        phase: 6,
        tab: "plan",
        keywords: ["objetivo", "viagem", "carro", "imóvel"],
      },
      {
        key: "emergency",
        label: "Reserva",
        href: "/reserva",
        icon: Shield,
        purpose: "Quantos meses do seu custo de vida estão protegidos.",
        phase: 6,
        tab: "plan",
        keywords: ["emergência", "reserva financeira"],
      },
      {
        key: "planning",
        label: "Projeções",
        href: "/planejamento",
        icon: LineChart,
        purpose: "Cenários conservador, base e otimista para os próximos anos.",
        phase: 8,
        tab: "plan",
        keywords: ["planejamento", "cenários", "futuro"],
      },
    ],
  },
  {
    label: "Patrimônio",
    items: [
      {
        key: "investments",
        label: "Investimentos",
        href: "/investimentos",
        icon: TrendingUp,
        purpose: "Carteira por classe, rentabilidade e histórico de aportes.",
        phase: 8,
        tab: "wealth",
        keywords: ["ações", "cdb", "tesouro", "fii", "cripto"],
      },
      {
        key: "netWorth",
        label: "Patrimônio",
        href: "/patrimonio",
        icon: Scale,
        purpose: "Ativos menos passivos: o retrato completo do que é seu.",
        phase: 8,
        tab: "wealth",
        keywords: ["bens", "imóveis", "veículos", "dívidas", "passivos"],
      },
    ],
  },
  {
    label: "Análise",
    items: [
      {
        key: "reports",
        label: "Relatórios",
        href: "/relatorios",
        icon: BarChart3,
        purpose: "Fluxo de caixa, gastos por categoria e evolução — exportáveis em CSV e PDF.",
        phase: 9,
        tab: "reports",
      },
    ],
  },
  {
    label: "Integrações",
    items: [
      {
        key: "claude",
        label: "Claude",
        href: "/conectar-claude",
        icon: MessagesSquare,
        purpose: "Use o Lastro conversando com o Claude: pergunte, registre gastos e acompanhe metas.",
        phase: 10,
        tab: "home",
        keywords: ["claude", "ia", "inteligência artificial", "assistente", "chat", "conector", "mcp", "conectar", "integração"],
      },
      {
        key: "codex",
        label: "Codex",
        href: "/conectar-codex",
        icon: SquareTerminal,
        purpose: "Use o Lastro pelo Codex, da OpenAI: pergunte, registre gastos e acompanhe metas.",
        phase: 10,
        tab: "home",
        keywords: ["codex", "openai", "chatgpt", "ia", "inteligência artificial", "assistente", "conector", "mcp", "conectar", "integração"],
      },
    ],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    key: "notifications",
    label: "Notificações",
    href: "/notificacoes",
    icon: Bell,
    purpose: "Vencimentos, orçamentos e metas que pedem sua atenção.",
    phase: 9,
    tab: "home",
  },
  {
    key: "profile",
    label: "Perfil e preferências",
    href: "/perfil",
    icon: UserRound,
    purpose: "Dados pessoais, preferências, segurança e sessões ativas.",
    phase: 3,
    tab: "home",
  },
];

export const ALL_ROUTES: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...SECONDARY_NAV];

export function getRoute(key: RouteKey): NavItem {
  const route = ALL_ROUTES.find((r) => r.key === key);
  if (!route) throw new Error(`Rota desconhecida: ${key}`);
  return route;
}

/** Tab bar mobile: 5 destinos, cada um abre o hub da seção. */
export const MOBILE_TABS: { tab: MobileTab; label: string; href: `/${string}`; icon: LucideIcon }[] = [
  { tab: "home", label: "Início", href: "/painel", icon: LayoutGrid },
  { tab: "transactions", label: "Lançamentos", href: "/lancamentos", icon: ArrowLeftRight },
  { tab: "plan", label: "Planejar", href: "/metas", icon: PiggyBank },
  { tab: "wealth", label: "Patrimônio", href: "/patrimonio", icon: Wallet },
  { tab: "reports", label: "Relatórios", href: "/relatorios", icon: BarChart3 },
];

export function tabForPath(pathname: string): MobileTab | undefined {
  return ALL_ROUTES.find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`))?.tab;
}

export function sectionSiblings(tab: MobileTab): NavItem[] {
  return NAV_GROUPS.flatMap((g) => g.items).filter((r) => r.tab === tab);
}
