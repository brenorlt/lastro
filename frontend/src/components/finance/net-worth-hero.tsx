import { cn } from "@/lib/cn";
import { formatCurrency, toNumber, type MoneyInput } from "@/lib/format";
import { Amount, Delta } from "./amount";

interface NetWorthHeroProps {
  netWorth: MoneyInput;
  assets: MoneyInput;
  liabilities: MoneyInput;
  /** Variação percentual no período. */
  change?: number;
  periodLabel?: string;
  className?: string;
  /** Modo privacidade: oculta valores, mantém a proporção. */
  hidden?: boolean;
}

/**
 * Elemento assinatura do Lastro: o patrimônio líquido em serifa, apoiado na
 * "linha de lastro" — uma régua que mostra quanto dos ativos está livre de dívidas.
 * É o único lugar da interface onde o latão (brass) aparece com destaque.
 */
export function NetWorthHero({ netWorth, assets, liabilities, change, periodLabel = "nos últimos 12 meses", className, hidden }: NetWorthHeroProps) {
  const money = (v: number) => (hidden ? "R$ ••••" : formatCurrency(v));
  const a = toNumber(assets);
  const l = toNumber(liabilities);
  const freeShare = a > 0 ? Math.max(0, Math.min(1, (a - l) / a)) : 0;
  const pct = Math.round(freeShare * 100);

  return (
    <section aria-labelledby="net-worth-label" className={cn("relative", className)}>
      <p id="net-worth-label" className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
        Patrimônio líquido
      </p>
      <Amount
        value={netWorth}
        hidden={hidden}
        splitCents
        className="mt-3 block font-display text-5xl font-normal leading-none tracking-[-0.02em] text-ink sm:text-6xl"
      />
      {change !== undefined && <Delta value={change} suffix={periodLabel} className="mt-4" />}

      <div className="mt-8 max-w-xl">
        <div className="relative h-px w-full bg-line-strong" aria-hidden>
          <div className="absolute inset-y-0 left-0 bg-brass" style={{ width: `${pct}%`, height: 2, top: -0.5 }} />
          <span className="absolute -top-[5px] size-[11px] rounded-full bg-canvas ring-2 ring-brass" style={{ left: `calc(${pct}% - 5.5px)` }} />
        </div>
        <dl className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-xs">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-3">Ativos</dt>
            <dd className="num font-medium text-ink">{money(a)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5 text-brass">
            <dd className="num font-medium">{pct}%</dd>
            <dt>livre de dívidas</dt>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-ink-3">Passivos</dt>
            <dd className="num font-medium text-ink">{money(l)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
