"use client";

import { ArrowDownRight, ArrowUpRight, Bitcoin, ChevronLeft, ChevronRight, DollarSign, Euro, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { type CSSProperties, createElement, useEffect, useState, useSyncExternalStore } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { DashboardInsight, MarketInsight } from "@/types/dashboard";
import { type TickerItem, tickerHeadline, tickerItems } from "../api";
import { emphasize, insightIcon } from "./dashboard-sections";

export const TICKER_INTERVAL_MS = 7000;

const CURRENCY_ICONS: Record<string, typeof Sparkles> = { USD: DollarSign, EUR: Euro, BTC: Bitcoin };
const TREND_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus };

/** Cor por tom: fundo em degradê, faixa lateral, ícone e número de destaque. */
const toneStyles = {
  neutral: {
    gradient: "from-accent-soft",
    stripe: "bg-accent",
    icon: "bg-accent-soft text-accent ring-accent/20",
    text: "text-ink",
  },
  positive: {
    gradient: "from-positive-soft",
    stripe: "bg-positive",
    icon: "bg-positive-soft text-positive ring-positive/25",
    text: "text-positive",
  },
  warning: {
    gradient: "from-warning-soft",
    stripe: "bg-warning",
    icon: "bg-warning-soft text-warning ring-warning/25",
    text: "text-warning",
  },
};

const HEADLINE_TREND = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

function iconFor(item: TickerItem) {
  if (item.source === "personal") return insightIcon(item.insight);
  if (item.insight.kind === "currency") return CURRENCY_ICONS[item.insight.symbol] ?? DollarSign;
  return TREND_ICONS[item.insight.trend];
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia?.(REDUCED_MOTION);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia?.(REDUCED_MOTION).matches ?? false,
    () => false,
  );
}

/** Um insight em card compacto: rótulo, número de destaque, frase e fonte. */
function InsightTile({ item, style }: { item: TickerItem; style?: CSSProperties }) {
  const headline = tickerHeadline(item);
  const tone = toneStyles[item.insight.tone];
  const TrendIcon = headline?.trend ? HEADLINE_TREND[headline.trend] : null;
  return (
    <li
      style={style}
      className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-lg bg-linear-to-b to-surface to-70% p-3.5 shadow-xs ring-1 ring-line sm:p-4", tone.gradient)}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", tone.stripe)} />
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", tone.icon)}>
          {createElement(iconFor(item), { className: "size-3.5", strokeWidth: 2, "aria-hidden": true })}
        </span>
        <span className="truncate text-2xs font-semibold uppercase tracking-wider text-ink-3">
          {item.source === "market" ? (headline?.label ?? "Mercado") : "Seu mês"}
        </span>
      </div>
      {headline && (
        <p aria-hidden className={cn("num mt-3 flex items-center gap-1 text-2xl font-semibold leading-none tracking-tight", tone.text)}>
          {TrendIcon && <TrendIcon className="size-5" strokeWidth={2.25} />}
          {headline.value}
          {item.source === "personal" && <span className="ml-1 text-2xs font-medium uppercase tracking-wider text-ink-3">{headline.label}</span>}
        </p>
      )}
      <p className="mt-2 line-clamp-3 text-xs text-ink-2 sm:text-sm [&_strong]:font-semibold [&_strong]:text-ink [&_strong]:num">
        {emphasize(item.insight.message)}
      </p>
      <p className="mt-auto truncate pt-2 text-2xs text-ink-3" title={item.insight.basis}>
        {item.insight.basis}
      </p>
    </li>
  );
}

export const TICKER_PAGE_SIZE = 4;

/**
 * Grade de insights do painel: 4 cards por vez (2×2 no celular), alternando alertas dos
 * próprios lançamentos e destaques de mercado. O grupo troca sozinho, com os cards deslizando em
 * cascata; pausa enquanto o mouse ou o foco estão na seção e não gira com movimento reduzido.
 */
export function InsightTicker({
  personal,
  market,
  title = "Insights",
  subtitle = "seu mês e o mercado agora",
  className = "mb-8",
}: {
  personal: DashboardInsight[];
  market: MarketInsight[];
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const items = tickerItems(personal, market);
  const reducedMotion = usePrefersReducedMotion();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [hovering, setHovering] = useState(false);

  const pages = Math.ceil(items.length / TICKER_PAGE_SIZE);
  const current = pages ? page % pages : 0;
  const rotating = pages > 1 && !hovering && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => {
      setDirection("next");
      setPage((p) => p + 1);
    }, TICKER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  if (!items.length) return null;
  const visible = items.slice(current * TICKER_PAGE_SIZE, (current + 1) * TICKER_PAGE_SIZE);
  const go = (delta: number) => {
    setDirection(delta > 0 ? "next" : "prev");
    setPage((current + delta + pages) % pages);
  };
  const slide = (i: number): CSSProperties | undefined =>
    reducedMotion
      ? undefined
      : { animation: `ticker-slide-${direction} 520ms var(--ease-out) ${i * 70}ms both` };

  return (
    <section
      aria-roledescription="carrossel"
      aria-label={title}
      className={className}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <span className="text-xs text-ink-3">{subtitle}</span>
        </div>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <div aria-hidden className="hidden items-center gap-1 xs:flex">
              {Array.from({ length: pages }, (_, i) => (
                <span key={i} className={cn("relative h-1 overflow-hidden rounded-full bg-line-strong transition-all duration-300", i === current ? "w-6" : "w-1.5")}>
                  {i === current && (
                    <span
                      key={`p:${current}`}
                      className="absolute inset-0 origin-left bg-accent"
                      style={
                        reducedMotion
                          ? undefined
                          : { animation: `ticker-progress ${TICKER_INTERVAL_MS}ms linear forwards`, animationPlayState: rotating ? "running" : "paused" }
                      }
                    />
                  )}
                </span>
              ))}
            </div>
            <span className="sr-only">
              Grupo {current + 1} de {pages}
            </span>
            <div className="flex items-center">
              <IconButton label="Insights anteriores" size="icon-sm" onClick={() => go(-1)}>
                <ChevronLeft />
              </IconButton>
              <IconButton label="Próximos insights" size="icon-sm" onClick={() => go(1)}>
                <ChevronRight />
              </IconButton>
            </div>
          </div>
        )}
      </div>
      <ul
        key={current}
        // Só anuncia trocas feitas pela pessoa; giro automático em aria-live seria ruído.
        aria-live={rotating ? "off" : "polite"}
        className="-mx-1 grid grid-cols-2 gap-3 overflow-x-clip px-1 py-0.5 lg:grid-cols-4"
      >
        {visible.map((item, i) => (
          <InsightTile key={`${item.source}:${item.insight.key}`} item={item} style={slide(i)} />
        ))}
      </ul>
    </section>
  );
}
