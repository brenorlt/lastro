import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import type { CurrencyQuote, StockQuote } from './market.types.js';

const AWESOME_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL';
const BRAPI_URL = 'https://brapi.dev/api/quote';
const TIMEOUT_MS = 5_000;

/** Tickers que a brapi serve sem token (plano gratuito). */
export const BRAPI_FREE_TICKERS = new Set(['PETR4', 'VALE3', 'ITUB4', 'MGLU3']);

interface AwesomeQuote {
  code: string;
  bid: string;
  pctChange: string;
  timestamp: string;
}

interface BrapiResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: string;
}

/**
 * HTTP fino para as fontes públicas de mercado. Sem cache nem tratamento de falha: isso é do
 * MarketService. Substituído nos testes.
 */
@Injectable()
export class MarketDataClient {
  constructor(private readonly config: AppConfigService) {}

  get hasBrapiToken(): boolean {
    return Boolean(this.config.get('BRAPI_TOKEN'));
  }

  async currencies(): Promise<CurrencyQuote[]> {
    const body = await this.getJson<Record<string, AwesomeQuote>>(AWESOME_URL);
    return Object.values(body)
      .filter((q) => ['USD', 'EUR', 'BTC'].includes(q.code))
      .map((q) => ({
        code: q.code as CurrencyQuote['code'],
        bid: Number(q.bid),
        changePct: Number(q.pctChange),
        quotedAt: new Date(Number(q.timestamp) * 1000),
      }))
      .filter((q) => Number.isFinite(q.bid) && Number.isFinite(q.changePct));
  }

  async stocks(symbols: string[]): Promise<StockQuote[]> {
    if (!symbols.length) return [];
    const url = new URL(`${BRAPI_URL}/${symbols.map(encodeURIComponent).join(',')}`);
    const token = this.config.get('BRAPI_TOKEN');
    const body = await this.getJson<{ results?: BrapiResult[] }>(
      url.toString(),
      token ? { Authorization: `Bearer ${token}` } : {},
    );
    return (body.results ?? [])
      .filter(
        (r) =>
          typeof r.regularMarketPrice === 'number' &&
          typeof r.regularMarketChangePercent === 'number',
      )
      .map((r) => ({
        symbol: r.symbol,
        name: r.shortName ?? r.longName ?? r.symbol,
        price: r.regularMarketPrice!,
        changePct: r.regularMarketChangePercent!,
        quotedAt: r.regularMarketTime ? new Date(r.regularMarketTime) : new Date(),
      }));
  }

  private async getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} em ${new URL(url).host}`);
    return (await response.json()) as T;
  }
}
