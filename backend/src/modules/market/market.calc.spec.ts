import { describe, expect, it } from '@jest/globals';
import { buildMarketInsights, type MarketInsightInput } from './market.calc.js';
import { normalizeTicker } from './market.service.js';
import type { StockQuote } from './market.types.js';

const at = new Date('2026-09-30T12:28:00Z'); // 09:28 em São Paulo

const stock = (symbol: string, price: number, changePct: number): StockQuote => ({
  symbol,
  name: symbol,
  price,
  changePct,
  quotedAt: at,
});

const base: MarketInsightInput = {
  currencies: [
    { code: 'USD', bid: 5.1774, changePct: -0.49394, quotedAt: at },
    { code: 'EUR', bid: 5.8877, changePct: 0.01, quotedAt: at },
    { code: 'BTC', bid: 435116, changePct: 1.2, quotedAt: at },
  ],
  index: null,
  stocks: [
    stock('PETR4', 49.1, 0.78),
    stock('VALE3', 69.61, -2.18),
    stock('ITUB4', 42.3, 1.41),
    stock('MGLU3', 6.63, 0.45),
  ],
  held: new Set(),
  timezone: 'America/Sao_Paulo',
};

describe('buildMarketInsights', () => {
  it('moedas com preço, variação e horário local; câmbio sem tom de bom/ruim', () => {
    const [usd, eur, btc] = buildMarketInsights(base);
    expect(usd).toMatchObject({
      key: 'USD_BRL',
      tone: 'neutral',
      trend: 'down',
      message: 'Dólar hoje: R$ 5,18 (−0,49% no dia).',
      basis: 'Câmbio comercial · AwesomeAPI · 09:28',
      value: -0.49,
    });
    expect(eur).toMatchObject({ trend: 'flat', message: 'Euro estável hoje: R$ 5,89.' });
    expect(btc.message).toBe('Bitcoin hoje: R$ 435.116 (+1,20% no dia).');
  });

  it('destaca maior alta e maior baixa das ações acompanhadas', () => {
    const insights = buildMarketInsights(base);
    expect(insights.find((i) => i.key === 'STOCK_TOP_GAINER')).toMatchObject({
      symbol: 'ITUB4',
      tone: 'positive',
      message: 'Destaque em alta: ITUB4 sobe 1,41% hoje, a R$ 42,30.',
    });
    expect(insights.find((i) => i.key === 'STOCK_TOP_LOSER')).toMatchObject({
      symbol: 'VALE3',
      tone: 'warning',
      message: 'Destaque em baixa: VALE3 cai 2,18% hoje, a R$ 69,61.',
    });
  });

  it('ativos da carteira ganham frase própria e saem dos destaques gerais', () => {
    const insights = buildMarketInsights({ ...base, held: new Set(['VALE3']) });
    expect(insights.find((i) => i.kind === 'holding')).toMatchObject({
      key: 'HOLDING_VALE3',
      message: 'Na sua carteira: VALE3 cai 2,18% hoje, a R$ 69,61.',
    });
    expect(insights.find((i) => i.key === 'STOCK_TOP_LOSER')).toBeUndefined();
  });

  it('sem baixa não há "destaque em baixa"; Ibovespa quando disponível', () => {
    const insights = buildMarketInsights({
      ...base,
      stocks: [stock('PETR4', 49.1, 0.78), stock('ITUB4', 42.3, 1.41)],
      index: stock('^BVSP', 131250.4, -0.3),
    });
    expect(insights.map((i) => i.key)).toEqual([
      'USD_BRL',
      'EUR_BRL',
      'BTC_BRL',
      'IBOV',
      'STOCK_TOP_GAINER',
    ]);
    expect(insights[3].message).toBe('Ibovespa cai 0,30% hoje, aos 131.250 pontos.');
  });

  it('sem cotações, sem insights', () => {
    expect(buildMarketInsights({ ...base, currencies: [], stocks: [] })).toEqual([]);
  });
});

describe('normalizeTicker', () => {
  it('aceita tickers da B3 e rejeita o resto', () => {
    expect(normalizeTicker(' petr4.sa ')).toBe('PETR4');
    expect(normalizeTicker('TAEE11')).toBe('TAEE11');
    expect(normalizeTicker('Tesouro Selic')).toBeNull();
    expect(normalizeTicker(null)).toBeNull();
  });
});
