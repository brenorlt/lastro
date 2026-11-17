import { ArrowDownLeft, ArrowUpRight, Bell, CreditCard, Shield, Target, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Amount, Delta } from "@/components/finance/amount";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { Badge, Card } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";

const NET_WORTH_SERIES = [182400, 186900, 191300, 195800, 199100, 204600, 210400, 216200, 221300, 228750];
const MONTHS = ["dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set"];

const SPENDING = [
  { label: "Moradia", value: 3400, color: "var(--series-1)" },
  { label: "Alimentação", value: 1860, color: "var(--series-2)" },
  { label: "Transporte", value: 940, color: "var(--series-3)" },
  { label: "Lazer", value: 820, color: "var(--series-4)" },
];

/** Caminho de linha/área em SVG, calculado no servidor: nenhum JS de gráfico vai para o navegador. */
function seriesPath(values: number[], width: number, height: number, pad = 8) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = width / (values.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);
  const points = values.map((v, i) => [i * step, y(v)] as const);
  const line = points.map(([x, py], i) => `${i ? "L" : "M"}${x.toFixed(1)},${py.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z`, last: points[points.length - 1] };
}

function MiniStat({
  label,
  value,
  icon: Icon,
  footer,
  flow,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  footer?: ReactNode;
  flow?: "income";
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <span className="text-ink-2 flex items-center gap-2 text-xs">
        <Icon className="text-ink-3 size-4" strokeWidth={1.75} aria-hidden />
        {label}
      </span>
      <Amount value={value} flow={flow} className="text-ink text-lg font-semibold tracking-tight sm:text-xl" />
      {footer}
    </Card>
  );
}

function NetWorthChart() {
  const W = 560;
  const H = 180;
  const { line, area, last } = seriesPath(NET_WORTH_SERIES, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-auto w-full" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="mock-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brass)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brass)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--grid)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#mock-area)" />
      <path
        d={line}
        fill="none"
        stroke="var(--brass)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0] - 3} cy={last[1]} r="5" fill="var(--surface)" stroke="var(--brass)" strokeWidth="2.5" />
      {MONTHS.map((m, i) => (
        <text
          key={m}
          x={(i * W) / (MONTHS.length - 1)}
          y={H + 18}
          fontSize="11"
          fill="var(--ink-3)"
          textAnchor={i === 0 ? "start" : i === MONTHS.length - 1 ? "end" : "middle"}
        >
          {m}
        </text>
      ))}
    </svg>
  );
}

/** Notificações reais do produto (vencimento, orçamento, meta) flutuando sobre a prévia. */
function FloatingNote({
  icon: Icon,
  title,
  detail,
  className,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  className: string;
  tone: string;
}) {
  return (
    <div
      className={`bg-surface-raised/95 ring-line absolute z-10 hidden w-64 items-start gap-3 rounded-xl p-3.5 shadow-lg ring-1 backdrop-blur md:flex ${className}`}
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="text-ink block text-sm font-medium">{title}</span>
        <span className="text-ink-2 mt-0.5 block text-xs">{detail}</span>
      </span>
    </div>
  );
}

/**
 * Prévia do painel com dados ilustrativos. Server Component com os mesmos tokens e componentes
 * de exibição do produto, mas gráficos em SVG puro — antes ela puxava o Recharts inteiro
 * (≈125 KB gzip) só para desenhar dois gráficos decorativos acima da dobra.
 */
export function ProductMockup() {
  const spendTotal = SPENDING.reduce((s, c) => s + c.value, 0);
  return (
    <div className="relative">
      <FloatingNote
        icon={Bell}
        title="Orçamento de Lazer em 82%"
        detail="Faltam R$ 180 até o limite do mês."
        tone="bg-warning-soft text-warning"
        className="float-slow bottom-40 -left-10 lg:-left-36"
      />
      <FloatingNote
        icon={Target}
        title="Meta “Viagem” no ritmo"
        detail="R$ 640/mês leva você lá em dez/2027."
        tone="bg-positive-soft text-positive"
        className="float-slower -right-10 -bottom-6 lg:-right-36"
      />
      <FloatingNote
        icon={CreditCard}
        title="Fatura fecha em 3 dias"
        detail="R$ 2.318,40 · 4 parcelas em aberto."
        tone="bg-accent-soft text-accent"
        className="float-slow -top-8 -right-6 lg:-right-14"
      />

      <Card
        className="ring-line overflow-hidden shadow-lg ring-1"
        role="img"
        aria-label="Prévia do painel do Lastro com dados ilustrativos: patrimônio crescendo, reserva e gastos por categoria"
      >
        <div className="border-line bg-surface-sunken/50 flex items-center gap-1.5 border-b px-4 py-3">
          <span className="bg-line-strong size-2.5 rounded-full" />
          <span className="bg-line-strong size-2.5 rounded-full" />
          <span className="bg-line-strong size-2.5 rounded-full" />
          <span className="text-2xs text-ink-3 ml-3">lastro.app/painel</span>
          <Badge tone="outline" className="ml-auto">
            Dados ilustrativos
          </Badge>
        </div>
        <div className="p-4 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-end">
            <NetWorthHero netWorth={228750.42} assets={271900} liabilities={43150} change={25.4} />
            <div className="hidden lg:block">
              <NetWorthChart />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-4">
            <MiniStat label="Saldo disponível" value={18420.1} icon={Wallet} />
            <MiniStat label="Receitas do mês" value={14200} icon={ArrowDownLeft} flow="income" />
            <MiniStat
              label="Despesas do mês"
              value={9150}
              icon={ArrowUpRight}
              footer={<Delta value={-16.1} inverse suffix="vs. agosto" />}
            />
            <MiniStat
              label="Investimentos"
              value={186300}
              icon={TrendingUp}
              footer={<Delta value={1.2} suffix="no mês" />}
            />
          </div>
          <div className="mt-4 hidden gap-4 sm:grid sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-ink flex items-center gap-2 text-sm font-medium">
                <Shield className="text-ink-3 size-4" aria-hidden /> Reserva de emergência
              </p>
              <Amount value={42000} className="text-ink mt-3 block text-2xl font-semibold" />
              <p className="text-ink-3 mt-1 text-xs">de {formatCurrency(60780)} · cobre 4,1 de 6 meses</p>
              <Progress value={42000} max={60780} tone="brass" className="mt-4" label="Progresso da reserva" />
            </Card>
            <Card className="p-5">
              <p className="text-ink text-sm font-medium">Para onde foi o dinheiro em setembro</p>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
                {SPENDING.map((c) => (
                  <span key={c.label} style={{ width: `${(c.value / spendTotal) * 100}%`, background: c.color }} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {SPENDING.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="text-ink-2 truncate">{c.label}</span>
                    <span className="num text-ink ml-auto">{formatCurrency(c.value)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
