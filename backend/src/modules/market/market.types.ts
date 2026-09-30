/** Cotação de moeda/cripto em reais (AwesomeAPI). */
export interface CurrencyQuote {
  code: 'USD' | 'EUR' | 'BTC';
  bid: number;
  /** Variação % no dia. */
  changePct: number;
  quotedAt: Date;
}

/** Cotação de ação ou índice da B3 (brapi). */
export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  quotedAt: Date;
}

export type MarketTrend = 'up' | 'down' | 'flat';

export interface MarketInsight {
  key: string;
  kind: 'currency' | 'index' | 'stock' | 'holding';
  tone: 'positive' | 'neutral' | 'warning';
  trend: MarketTrend;
  symbol: string;
  message: string;
  basis: string;
  /** Variação % no dia (2 casas). */
  value: number;
}
