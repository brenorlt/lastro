import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { currencyParts, formatCurrency, formatPercent, toNumber, type MoneyInput } from "@/lib/format";

interface AmountProps {
  value: MoneyInput;
  /** income/expense colore e sinaliza o fluxo; neutral mantém a tinta padrão. */
  flow?: "income" | "expense" | "neutral";
  currency?: string;
  className?: string;
  /** Centavos em tamanho menor — para valores de destaque. */
  splitCents?: boolean;
  hidden?: boolean;
}

/** Valor monetário. Sempre tabular; nunca usa só cor para indicar entrada/saída. */
export function Amount({ value, flow = "neutral", currency, className, splitCents, hidden }: AmountProps) {
  if (hidden) {
    return (
      <span className={cn("num", className)} aria-label="Valor oculto">
        R$ ••••
      </span>
    );
  }
  const n = Math.abs(toNumber(value));
  const sign = flow === "income" ? "+" : flow === "expense" ? "−" : toNumber(value) < 0 ? "−" : "";
  const tone = flow === "income" ? "text-positive" : flow === "expense" ? "text-ink" : "";
  const srPrefix = flow === "income" ? "Entrada de " : flow === "expense" ? "Saída de " : "";

  if (splitCents) {
    const p = currencyParts(n, currency);
    return (
      <span className={cn("num whitespace-nowrap", tone, className)}>
        <span className="sr-only">{srPrefix}{formatCurrency(n, { currency })}</span>
        <span aria-hidden>
          {sign}
          <span className="mr-[0.15em] text-[0.5em] align-[0.6em] font-sans font-medium text-ink-3">{p.symbol}</span>
          {p.integer}
          <span className="text-[0.55em] text-ink-3">{p.decimal}{p.fraction}</span>
        </span>
      </span>
    );
  }

  return (
    <span className={cn("num whitespace-nowrap", tone, className)}>
      <span className="sr-only">{srPrefix}</span>
      {sign && <span aria-hidden>{sign}</span>}
      {formatCurrency(n, { currency })}
    </span>
  );
}

interface DeltaProps {
  /** Variação percentual (ex.: -12.4). */
  value: number;
  /** Para despesas, cair é bom: inverte a semântica de cor. */
  inverse?: boolean;
  suffix?: string;
  className?: string;
}

/** Variação com ícone + sinal + cor — três canais, nunca só cor. */
export function Delta({ value, inverse, suffix = "vs. mês anterior", className }: DeltaProps) {
  const flat = Math.abs(value) < 0.05;
  const good = inverse ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? "text-ink-3" : good ? "text-positive" : "text-negative";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <span className={cn("inline-flex items-center gap-0.5 font-medium num", tone)}>
        <Icon className="size-3.5" aria-hidden />
        {formatPercent(value, { signed: true })}
      </span>
      {suffix && <span className="text-ink-3">{suffix}</span>}
    </span>
  );
}
