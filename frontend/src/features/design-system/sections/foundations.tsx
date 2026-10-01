import { Card } from "@/components/ui/primitives";
import { DsExample, DsSection } from "../section";

const COLORS: { token: string; role: string; light: string; dark: string; ratio?: string }[] = [
  { token: "canvas", role: "Fundo da aplicação", light: "#E2E7F1", dark: "#17181C" },
  { token: "surface", role: "Cards e painéis", light: "#FFFFFF", dark: "#202329" },
  { token: "surface-sunken", role: "Campos, trilhas, hover", light: "#EEF2F7", dark: "#121317" },
  { token: "ink", role: "Texto principal", light: "#244C4E", dark: "#F2F2EF", ratio: "7.6 / 15.8" },
  { token: "ink-2", role: "Texto secundário", light: "#4C5267", dark: "#B7BCC3", ratio: "6.3 / 9.3" },
  { token: "ink-3", role: "Rótulos e metadados", light: "#5A6075", dark: "#9AA0A8", ratio: "5.0 / 6.7" },
  { token: "accent", role: "Interação: links, foco, seleção", light: "#2D6E57", dark: "#8E9BFF", ratio: "4.9 / 7.0" },
  { token: "action", role: "Fundo do botão primário", light: "#9EEA6C", dark: "#8E9BFF" },
  { token: "brass", role: "Exclusivo do patrimônio", light: "#805F25", dark: "#D6B36E", ratio: "4.7 / 8.9" },
  { token: "positive", role: "Entradas, metas atingidas", light: "#0A7350", dark: "#4FCB95", ratio: "4.7 / 8.7" },
  { token: "negative", role: "Excesso, erro, ação destrutiva", light: "#B3342D", dark: "#F2847B", ratio: "4.9 / 7.1" },
  { token: "warning", role: "Atenção (80% do orçamento)", light: "#8F5B00", dark: "#E6B04C", ratio: "4.6 / 9.0" },
];

const TYPE = [
  { name: "Display", cls: "font-display text-5xl", spec: "Newsreader 60/60 — patrimônio e headlines" },
  { name: "Título 1", cls: "text-3xl font-semibold tracking-tight", spec: "Geist 32/38 semibold" },
  { name: "Título 2", cls: "text-2xl font-semibold tracking-tight", spec: "Geist 24/32 semibold" },
  { name: "Título 3", cls: "text-lg font-medium", spec: "Geist 17/26 medium" },
  { name: "Corpo", cls: "text-base", spec: "Geist 15/24 regular" },
  { name: "Apoio", cls: "text-sm text-ink-2", spec: "Geist 14/20" },
  { name: "Rótulo", cls: "text-xs text-ink-3", spec: "Geist 13/18" },
  { name: "Legenda", cls: "text-2xs uppercase tracking-[0.1em] text-ink-3", spec: "Geist 12/16 — mínimo" },
];

const SPACE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
const RADII = [
  { t: "xs", v: 6 },
  { t: "sm", v: 8 },
  { t: "md", v: 12 },
  { t: "lg", v: 16 },
  { t: "xl", v: 22 },
  { t: "2xl", v: 28 },
];

export function FoundationsSection() {
  return (
    <>
      <DsSection
        id="cores"
        eyebrow="Fundamentos"
        title="Cores por papel"
        description="Cada cor tem um único significado. O latão (brass) aparece apenas onde o assunto é patrimônio. Contraste WCAG medido sobre o fundo (claro / escuro)."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLORS.map((c) => (
            <Card key={c.token} className="flex items-center gap-4 p-4">
              <div className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-line">
                <span className="size-10" style={{ background: c.light }} />
                <span className="size-10" style={{ background: c.dark }} />
              </div>
              <div className="min-w-0 text-xs">
                <p className="font-mono text-sm text-ink">--{c.token}</p>
                <p className="truncate text-ink-2">{c.role}</p>
                {c.ratio && <p className="num text-ink-3">{c.ratio} : 1</p>}
              </div>
            </Card>
          ))}
        </div>
        <DsExample label="Gráficos — categórico em ordem fixa (validado para daltonismo)" className="mt-8">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line">
                <span className="size-3 rounded-full" style={{ background: `var(--series-${n})` }} />
                series-{n}
              </span>
            ))}
          </div>
        </DsExample>
      </DsSection>

      <DsSection
        id="tipografia"
        eyebrow="Fundamentos"
        title="Tipografia"
        description="Newsreader, uma serifa editorial, é usada com parcimônia — no número do patrimônio e em headlines — evocando o rigor de um extrato impresso. Geist carrega toda a interface. Números sempre com algarismos tabulares."
      >
        <Card className="divide-y divide-line">
          {TYPE.map((t) => (
            <div key={t.name} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-8">
              <span className="w-24 shrink-0 text-xs text-ink-3">{t.name}</span>
              <span className={`${t.cls} min-w-0 flex-1 truncate`}>Patrimônio em evolução</span>
              <span className="text-xs text-ink-3">{t.spec}</span>
            </div>
          ))}
        </Card>
      </DsSection>

      <DsSection id="espaco" eyebrow="Fundamentos" title="Espaço, raio e elevação" description="Escala base 4px. Raios concêntricos: um card de 22px contém controles de 12px. No escuro, a elevação vem da superfície mais clara, não da sombra.">
        <div className="grid gap-8 lg:grid-cols-3">
          <DsExample label="Espaçamento">
            <div className="space-y-1.5">
              {SPACE.map((s) => (
                <div key={s} className="flex items-center gap-3 text-xs text-ink-3">
                  <span className="num w-7 text-right">{s}</span>
                  <span className="h-2.5 rounded-xs bg-accent/70" style={{ width: s * 2 }} />
                </div>
              ))}
            </div>
          </DsExample>
          <DsExample label="Raios">
            <div className="grid grid-cols-3 gap-3">
              {RADII.map((r) => (
                <div key={r.t} className="flex flex-col items-center gap-2 text-xs text-ink-3">
                  <span className="size-14 bg-surface ring-1 ring-line-strong" style={{ borderRadius: r.v }} />
                  {r.t} · {r.v}
                </div>
              ))}
            </div>
          </DsExample>
          <DsExample label="Sombras">
            <div className="grid grid-cols-2 gap-4">
              {["xs", "sm", "md", "lg"].map((s) => (
                <div key={s} className="flex h-16 items-center justify-center rounded-lg bg-surface text-xs text-ink-3" style={{ boxShadow: `var(--shadow-${s})` }}>
                  shadow-{s}
                </div>
              ))}
            </div>
          </DsExample>
        </div>
      </DsSection>
    </>
  );
}
