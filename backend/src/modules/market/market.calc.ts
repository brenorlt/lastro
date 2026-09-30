import type { CurrencyQuote, MarketInsight, MarketTrend, StockQuote } from './market.types.js';

/** Abaixo disso (em %) a variação é tratada como estável. */
const FLAT_THRESHOLD = 0.05;
const MAX_HOLDINGS = 3;

const CURRENCY_LABEL: Record<CurrencyQuote['code'], string> = {
  USD: 'Dólar',
  EUR: 'Euro',
  BTC: 'Bitcoin',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function trendOf(changePct: number): MarketTrend {
  if (Math.abs(changePct) < FLAT_THRESHOLD) return 'flat';
  return changePct > 0 ? 'up' : 'down';
}

function brl(value: number, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(/\u00a0/g, ' ');
}

const pct = (n: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))}%`;

/** "sobe 0,78%" · "cai 2,18%" · "estável". */
function movement(changePct: number): string {
  const trend = trendOf(changePct);
  if (trend === 'flat') return 'estável';
  return `${trend === 'up' ? 'sobe' : 'cai'} ${pct(changePct)}`;
}

function time(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}

const stockTone = (changePct: number): MarketInsight['tone'] => {
  const trend = trendOf(changePct);
  return trend === 'up' ? 'positive' : trend === 'down' ? 'warning' : 'neutral';
};

export interface MarketInsightInput {
  currencies: CurrencyQuote[];
  /** Índice (ex.: ^BVSP) — só disponível com token da brapi. */
  index: StockQuote | null;
  stocks: StockQuote[];
  /** Tickers presentes na carteira do usuário. */
  held: Set<string>;
  timezone: string;
}

/**
 * Frases de mercado para o painel: moedas, índice, ativos da carteira do usuário e a maior
 * alta/baixa entre as ações acompanhadas. Câmbio não tem tom de "bom/ruim" (depende de quem lê).
 */
export function buildMarketInsights(input: MarketInsightInput): MarketInsight[] {
  const insights: MarketInsight[] = [];

  for (const code of ['USD', 'EUR', 'BTC'] as const) {
    const q = input.currencies.find((c) => c.code === code);
    if (!q) continue;
    const price = brl(q.bid, code === 'BTC' ? 0 : 2);
    const trend = trendOf(q.changePct);
    insights.push({
      key: `${code}_BRL`,
      kind: 'currency',
      tone: 'neutral',
      trend,
      symbol: code,
      message:
        trend === 'flat'
          ? `${CURRENCY_LABEL[code]} estável hoje: ${price}.`
          : `${CURRENCY_LABEL[code]} hoje: ${price} (${trend === 'up' ? '+' : '−'}${pct(q.changePct)} no dia).`,
      basis: `${code === 'BTC' ? 'Cotação' : 'Câmbio comercial'} · AwesomeAPI · ${time(q.quotedAt, input.timezone)}`,
      value: round2(q.changePct),
    });
  }

  if (input.index) {
    const q = input.index;
    insights.push({
      key: 'IBOV',
      kind: 'index',
      tone: stockTone(q.changePct),
      trend: trendOf(q.changePct),
      symbol: 'IBOV',
      message: `Ibovespa ${movement(q.changePct)} hoje, aos ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(q.price)} pontos.`,
      basis: `B3 · brapi · ${time(q.quotedAt, input.timezone)}`,
      value: round2(q.changePct),
    });
  }

  const held = input.stocks
    .filter((s) => input.held.has(s.symbol))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, MAX_HOLDINGS);
  for (const q of held) {
    insights.push({
      key: `HOLDING_${q.symbol}`,
      kind: 'holding',
      tone: stockTone(q.changePct),
      trend: trendOf(q.changePct),
      symbol: q.symbol,
      message: `Na sua carteira: ${q.symbol} ${movement(q.changePct)} hoje, a ${brl(q.price)}.`,
      basis: `B3 · brapi · ${time(q.quotedAt, input.timezone)}`,
      value: round2(q.changePct),
    });
  }

  // Maior alta e maior baixa entre as ações acompanhadas que não são do usuário.
  const others = input.stocks
    .filter((s) => !input.held.has(s.symbol))
    .sort((a, b) => b.changePct - a.changePct);
  const top = others[0];
  const bottom = others.at(-1);
  if (top && trendOf(top.changePct) === 'up') {
    insights.push(stockInsight('STOCK_TOP_GAINER', 'em alta', top, input.timezone));
  }
  if (bottom && bottom !== top && trendOf(bottom.changePct) === 'down') {
    insights.push(stockInsight('STOCK_TOP_LOSER', 'em baixa', bottom, input.timezone));
  }

  return insights;
}

function stockInsight(key: string, label: string, q: StockQuote, timezone: string): MarketInsight {
  return {
    key,
    kind: 'stock',
    tone: stockTone(q.changePct),
    trend: trendOf(q.changePct),
    symbol: q.symbol,
    message: `Destaque ${label}: ${q.symbol} ${movement(q.changePct)} hoje, a ${brl(q.price)}.`,
    basis: `B3 · brapi · ${time(q.quotedAt, timezone)}`,
    value: round2(q.changePct),
  };
}
