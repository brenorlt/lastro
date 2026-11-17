import { Check, FileUp, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./section-heading";

/* Mini-prévias em HTML/SVG puro: cada bloco mostra a tela real resumida, sem JS. */

function PatrimonyVisual() {
  const bars = [38, 44, 47, 52, 55, 61, 66, 70, 76, 84];
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end">
      <div>
        <p className="text-ink-3 text-2xs tracking-[0.14em] uppercase">Patrimônio líquido</p>
        <p className="font-display num text-ink mt-1 text-4xl tracking-tight sm:text-5xl">
          <span className="text-ink-3 mr-1 align-[0.5em] font-sans text-base">R$</span>228.750
          <span className="text-ink-3 text-2xl">,42</span>
        </p>
        <div className="bg-line-strong relative mt-5 h-px" aria-hidden>
          <span className="bg-brass absolute -top-px left-0 h-0.5 w-[84%]" />
        </div>
        <p className="text-ink-3 mt-2 flex justify-between gap-3 text-xs">
          <span>Ativos R$ 271.900</span>
          <span>Dívidas R$ 43.150</span>
        </p>
      </div>
      {/* Barra em absolute: a % resolve contra a altura do contêiner, sem depender do conteúdo. */}
      <div className="flex h-36 gap-1.5 sm:gap-2" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="relative flex-1">
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 rounded-t-[4px]",
                i === bars.length - 1 ? "bg-brass" : "bg-brass/25",
              )}
              style={{ height: `${h}%` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function ImportVisual() {
  const rows = [
    { d: "IFOOD *RESTAURANTE", c: "Alimentação", v: "−48,90" },
    { d: "UBER *TRIP", c: "Transporte", v: "−23,40" },
    { d: "PIX RECEBIDO", c: "Receita", v: "+1.200,00" },
  ];
  return (
    <div className="mt-6 space-y-2" aria-hidden>
      <div className="border-line-strong text-ink-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs">
        <FileUp className="text-accent size-4" />
        extrato-setembro.ofx
        <span className="text-positive ml-auto">143 linhas</span>
      </div>
      {rows.map((r) => (
        <div key={r.d} className="bg-surface-sunken flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
          <span className="text-ink-2 min-w-0 flex-1 truncate font-mono text-[11px]">{r.d}</span>
          <span className="bg-accent-soft text-accent flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
            <Sparkles className="size-3" />
            {r.c}
          </span>
          <span className="num text-ink w-16 text-right">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function CardVisual() {
  return (
    <div className="mt-6" aria-hidden>
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#2b2f3a] to-[#14161b] p-4 text-white shadow-md ring-1 ring-white/10">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>Fatura atual · fecha dia 28</span>
          <span>•••• 4021</span>
        </div>
        <p className="num mt-3 text-2xl font-semibold">R$ 2.318,40</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full w-[46%] rounded-full bg-white/80" />
        </div>
        <p className="mt-1.5 text-[11px] text-white/60">Limite disponível R$ 2.681,60</p>
      </div>
      <p className="text-ink-3 mt-3 text-xs">Próxima fatura: R$ 1.146,20 · 4 parcelas</p>
    </div>
  );
}

function BudgetVisual() {
  const items = [
    { c: "Mercado", p: 46, tone: "bg-accent" },
    { c: "Lazer", p: 82, tone: "bg-warning" },
    { c: "Delivery", p: 104, tone: "bg-negative" },
  ];
  return (
    <ul className="mt-6 space-y-3.5" aria-hidden>
      {items.map((i) => (
        <li key={i.c}>
          <div className="flex justify-between text-xs">
            <span className="text-ink-2">{i.c}</span>
            <span className="num text-ink">{i.p}%</span>
          </div>
          <div className="bg-surface-sunken mt-1.5 h-2 overflow-hidden rounded-full">
            <span className={cn("block h-full rounded-full", i.tone)} style={{ width: `${Math.min(i.p, 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function GoalVisual() {
  return (
    <div className="bg-surface-sunken mt-6 rounded-xl p-4" aria-hidden>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink font-medium">✈️ Viagem para o Japão</span>
        <span className="text-ink-3">dez/2027</span>
      </div>
      <p className="num text-ink mt-3 text-xl font-semibold">
        R$ 640<span className="text-ink-3 text-sm font-normal">/mês</span>
      </p>
      <p className="text-ink-3 text-xs">para chegar a R$ 18.000 no prazo</p>
      <div className="bg-canvas mt-3 h-2 overflow-hidden rounded-full">
        <span className="bg-positive block h-full w-[38%] rounded-full" />
      </div>
    </div>
  );
}

function ReserveVisual() {
  const months = 6;
  const covered = 4.1;
  return (
    <div className="mt-6" aria-hidden>
      <div className="flex gap-1.5">
        {Array.from({ length: months }, (_, i) => {
          const fill = Math.max(0, Math.min(1, covered - i));
          return (
            <span key={i} className="bg-surface-sunken relative h-14 flex-1 overflow-hidden rounded-md">
              <span className="bg-brass/80 absolute inset-x-0 bottom-0" style={{ height: `${fill * 100}%` }} />
            </span>
          );
        })}
      </div>
      <p className="text-ink-2 mt-3 text-xs">
        <span className="num text-ink font-medium">4,1 de 6 meses</span> do seu custo de vida protegidos
      </p>
    </div>
  );
}

function ProjectionVisual() {
  const W = 320;
  const H = 120;
  const lines = [
    { d: `M0,${H - 10} C110,${H - 30} 220,${H - 55} ${W},${H - 70}`, o: 0.45, label: "Conservador" },
    { d: `M0,${H - 10} C110,${H - 38} 220,${H - 75} ${W},${H - 95}`, o: 1, label: "Base" },
    { d: `M0,${H - 10} C110,${H - 45} 220,${H - 95} ${W},${H - 112}`, o: 0.7, label: "Otimista" },
  ];
  return (
    <div className="mt-6" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none">
        {lines.map((l) => (
          <path
            key={l.label}
            d={l.d}
            fill="none"
            stroke="var(--brass)"
            strokeOpacity={l.o}
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="text-ink-3 mt-2 flex justify-between text-xs">
        <span>Hoje</span>
        <span>Conservador · Base · Otimista</span>
        <span>10 anos</span>
      </div>
    </div>
  );
}

interface Tile {
  title: string;
  description: string;
  visual: ReactNode;
  className?: string;
  eyebrow: string;
}

const TILES: Tile[] = [
  {
    eyebrow: "Patrimônio",
    title: "Quanto você realmente tem? Uma resposta, não um palpite.",
    description: "Contas, investimentos, imóveis e veículos menos dívidas e financiamentos — num só número, mês a mês.",
    visual: <PatrimonyVisual />,
    className: "lg:col-span-2",
  },
  {
    eyebrow: "Importação",
    title: "Seu extrato vira lançamentos em segundos.",
    description:
      "Solte o OFX ou CSV do banco: o Lastro sugere a categoria, aponta duplicatas e nunca importa a mesma linha duas vezes.",
    visual: <ImportVisual />,
  },
  {
    eyebrow: "Cartões",
    title: "A fatura nunca mais é surpresa.",
    description: "Fechamento e vencimento reais, parcelas distribuídas sozinhas e o limite disponível sempre à vista.",
    visual: <CardVisual />,
  },
  {
    eyebrow: "Orçamento",
    title: "O aviso chega antes de estourar.",
    description: "Limite por categoria com alertas em 50%, 80% e 100%. Você corrige a rota no meio do mês, não no fim.",
    visual: <BudgetVisual />,
  },
  {
    eyebrow: "Metas",
    title: "Sonho com valor, prazo e parcela.",
    description: "Diga quanto e até quando. O Lastro calcula quanto guardar por mês e mostra se você está no ritmo.",
    visual: <GoalVisual />,
  },
  {
    eyebrow: "Reserva de emergência",
    title: "Quantos meses você aguenta sem salário?",
    description: "O valor ideal pelo seu custo de vida real, com o progresso a cada aporte.",
    visual: <ReserveVisual />,
  },
  {
    eyebrow: "Projeções",
    title: "Veja seu patrimônio daqui a 10 anos.",
    description:
      "Três cenários com o que você poupa e investe hoje. Estimativas, sempre sinalizadas — nunca promessas.",
    visual: <ProjectionVisual />,
    className: "lg:col-span-2",
  },
];

export function FeaturesBento() {
  return (
    <section id="produto" data-section="produto" className="defer-render scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="O produto"
          tone="brass"
          title={
            <>
              Tudo o que o seu dinheiro faz. <span className="text-ink-2 italic">Numa tela só.</span>
            </>
          }
          description="Não é mais um app que mostra números soltos. Cada parte conversa com a outra: o gasto no cartão mexe no orçamento, que mexe na meta, que mexe no patrimônio."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <li
              key={t.eyebrow}
              className={cn(
                "reveal bg-surface ring-line group relative flex flex-col overflow-hidden rounded-2xl p-6 ring-1 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-7",
                t.className,
              )}
            >
              <span className="text-brass text-2xs font-medium tracking-[0.14em] uppercase">{t.eyebrow}</span>
              <h3 className="text-ink mt-2 text-lg leading-snug font-semibold tracking-tight">{t.title}</h3>
              <p className="text-ink-2 mt-2 text-sm">{t.description}</p>
              <div className="mt-auto">{t.visual}</div>
            </li>
          ))}
        </ul>

        <ul className="text-ink-2 mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {[
            "Investimentos por classe",
            "Lançamentos recorrentes e parcelados",
            "Relatórios em CSV e PDF",
            "Busca global e atalhos",
            "Modo privacidade",
          ].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <Check className="text-positive size-4" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
