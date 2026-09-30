import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BRAPI_FREE_TICKERS, MarketDataClient } from './market.client.js';
import { buildMarketInsights } from './market.calc.js';
import type { CurrencyQuote, MarketInsight, StockQuote } from './market.types.js';

/** Cotações são compartilhadas entre usuários: uma busca a cada 10 min por ativo. */
export const MARKET_CACHE_TTL_MS = 10 * 60 * 1000;
const INDEX_SYMBOL = '^BVSP';
const TICKER_REGEX = /^[A-Z]{4}\d{1,2}[A-Z]?$/;

interface Cached<T> {
  value: T;
  fetchedAt: number;
}

export interface MarketInsightsResult {
  /** Horário da cotação mais recente usada (null = nenhuma fonte respondeu ainda). */
  updatedAt: string | null;
  insights: MarketInsight[];
}

/** "petr4.sa" → "PETR4"; null se não parecer um ticker da B3. */
export function normalizeTicker(raw: string | null): string | null {
  if (!raw) return null;
  const ticker = raw.trim().toUpperCase().replace(/\.SA$/, '');
  return TICKER_REGEX.test(ticker) ? ticker : null;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private currencyCache: Cached<CurrencyQuote[]> | null = null;
  private readonly stockCache = new Map<string, Cached<StockQuote>>();
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: MarketDataClient,
    private readonly config: AppConfigService,
  ) {}

  async insightsFor(userId: string): Promise<MarketInsightsResult> {
    const [user, investments] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
      this.prisma.investment.findMany({
        where: { userId, deletedAt: null, ticker: { not: null }, quantity: { gt: 0 } },
        select: { ticker: true },
      }),
    ]);

    // Sem token, a brapi só atende a lista gratuita — ativos fora dela ficam de fora.
    const allowed = (t: string) => this.client.hasBrapiToken || BRAPI_FREE_TICKERS.has(t);
    const held = new Set(
      investments
        .map((i) => normalizeTicker(i.ticker))
        .filter((t): t is string => t !== null && allowed(t)),
    );
    const watched = this.config.get('MARKET_TICKERS').filter(allowed);
    const symbols = [...new Set([...watched, ...held])];
    if (this.client.hasBrapiToken) symbols.push(INDEX_SYMBOL);

    const [currencies, quotes] = await Promise.all([this.currencies(), this.stocks(symbols)]);
    const index = quotes.find((q) => q.symbol === INDEX_SYMBOL) ?? null;
    const stocks = quotes.filter((q) => q.symbol !== INDEX_SYMBOL);

    const times = [...currencies, ...quotes].map((q) => q.quotedAt.getTime());
    return {
      updatedAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
      insights: buildMarketInsights({ currencies, index, stocks, held, timezone: user.timezone }),
    };
  }

  /** Fresco se possível; em falha da fonte, o último valor conhecido (ou nada). */
  private async currencies(): Promise<CurrencyQuote[]> {
    if (!this.isFresh(this.currencyCache)) {
      await this.once('currencies', async () => {
        const value = await this.client.currencies();
        this.currencyCache = { value, fetchedAt: Date.now() };
      });
    }
    return this.currencyCache?.value ?? [];
  }

  private async stocks(symbols: string[]): Promise<StockQuote[]> {
    const stale = symbols.filter((s) => !this.isFresh(this.stockCache.get(s)));
    if (stale.length) {
      await this.once(`stocks:${[...stale].sort().join(',')}`, async () => {
        const fetchedAt = Date.now();
        for (const quote of await this.client.stocks(stale)) {
          this.stockCache.set(quote.symbol, { value: quote, fetchedAt });
        }
      });
    }
    return symbols
      .map((s) => this.stockCache.get(s)?.value)
      .filter((q): q is StockQuote => q !== undefined);
  }

  private isFresh(entry: Cached<unknown> | null | undefined): boolean {
    return (
      entry !== null && entry !== undefined && Date.now() - entry.fetchedAt < MARKET_CACHE_TTL_MS
    );
  }

  /** Requisições simultâneas pela mesma chave compartilham uma busca; falhas só são logadas. */
  private once(key: string, task: () => Promise<void>): Promise<void> {
    const running = this.inflight.get(key);
    if (running) return running;
    const promise = task()
      .catch((error: unknown) => {
        this.logger.warn(
          { source: key, err: error instanceof Error ? error.message : String(error) },
          'Fonte de cotações indisponível — usando último valor conhecido',
        );
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}
