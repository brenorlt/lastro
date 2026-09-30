import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MarketDataClient } from '../src/modules/market/market.client.js';
import { MarketService } from '../src/modules/market/market.service.js';
import type { CurrencyQuote, StockQuote } from '../src/modules/market/market.types.js';
import { quickUser } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface MarketBody {
  data: {
    updatedAt: string | null;
    insights: { key: string; kind: string; symbol: string; message: string }[];
  };
}

const at = new Date('2026-09-30T12:28:00Z');
const quote = (symbol: string, changePct: number): StockQuote => ({
  symbol,
  name: symbol,
  price: 10,
  changePct,
  quotedAt: at,
});

describe('Market insights (e2e)', () => {
  let ctx: TestContext;
  let client: MarketDataClient;
  let currencies: jest.SpiedFunction<MarketDataClient['currencies']>;
  let stocks: jest.SpiedFunction<MarketDataClient['stocks']>;

  beforeAll(async () => {
    ctx = await createTestApp();
    client = ctx.app.get(MarketDataClient);
    currencies = jest.spyOn(client, 'currencies');
    stocks = jest.spyOn(client, 'stocks');
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(() => {
    // Cache limpo a cada teste (é compartilhado entre usuários por design).
    const service = ctx.app.get(MarketService);
    Reflect.set(service, 'currencyCache', null);
    (Reflect.get(service, 'stockCache') as Map<string, unknown>).clear();
    currencies.mockReset();
    stocks.mockReset();
    currencies.mockResolvedValue([
      { code: 'USD', bid: 5.2, changePct: 0.5, quotedAt: at } satisfies CurrencyQuote,
    ]);
    stocks.mockImplementation((symbols) =>
      Promise.resolve(symbols.map((s, i) => quote(s, i % 2 ? -1 - i : 1 + i))),
    );
  });

  it('exige autenticação', async () => {
    const { default: request } = await import('supertest');
    await request(ctx.http).get('/api/market/insights').expect(401);
  });

  it('inclui ativos da carteira (só tickers válidos e com posição) e cacheia as fontes', async () => {
    const { user, client: http } = await quickUser(ctx, 'mercado');
    await ctx.prisma.investment.createMany({
      data: [
        { userId: user.id, name: 'Vale', ticker: 'vale3.sa', type: 'STOCKS', quantity: 10 },
        { userId: user.id, name: 'Zerada', ticker: 'ITUB4', type: 'STOCKS', quantity: 0 },
        { userId: user.id, name: 'Selic', ticker: null, type: 'TREASURY' },
      ],
    });

    const first = (await http.get('/api/market/insights').expect(200)).body as MarketBody;
    expect(first.data.updatedAt).toBe(at.toISOString());
    expect(first.data.insights[0]).toMatchObject({ key: 'USD_BRL', kind: 'currency' });
    expect(first.data.insights.filter((i) => i.kind === 'holding').map((i) => i.symbol)).toEqual([
      'VALE3',
    ]);
    // Sem BRAPI_TOKEN: só a lista gratuita, sem Ibovespa.
    expect(stocks).toHaveBeenCalledWith(['PETR4', 'VALE3', 'ITUB4', 'MGLU3']);

    await http.get('/api/market/insights').expect(200);
    expect(currencies).toHaveBeenCalledTimes(1);
    expect(stocks).toHaveBeenCalledTimes(1);
  });

  it('fonte fora do ar não derruba o endpoint: devolve o que houver', async () => {
    const { client: http } = await quickUser(ctx, 'mercado-falha');
    currencies.mockRejectedValue(new Error('timeout'));
    stocks.mockRejectedValue(new Error('HTTP 500'));

    const res = (await http.get('/api/market/insights').expect(200)).body as MarketBody;
    expect(res.data).toEqual({ updatedAt: null, insights: [] });
  });
});
