import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import {
  type EngineTx,
  InsufficientPositionError,
  monthlySeries,
  profitOf,
  replay,
} from './investment.engine.js';

const d = (v: string) => new Decimal(v);
const tx = (type: EngineTx['type'], amount: string, date: string, quantity?: string): EngineTx => ({
  type,
  amount: d(amount),
  quantity: quantity ? d(quantity) : null,
  date,
});
const fixed = (v: Decimal | null) => v?.toFixed(2) ?? null;

describe('motor de investimentos (replay)', () => {
  it('BUY com preço médio ponderado', () => {
    const s = replay([
      tx('BUY', '1000', '2026-01-10', '100'),
      tx('BUY', '600', '2026-02-10', '50'),
    ]);
    expect(s.quantity?.toFixed(0)).toBe('150');
    expect(s.averagePrice?.toFixed(4)).toBe('10.6667');
    expect([fixed(s.investedAmount), fixed(s.currentValue)]).toEqual(['1600.00', '1600.00']);
  });

  it('SELL parcial por quantidade baixa custo proporcional e registra ganho realizado', () => {
    const s = replay([
      tx('BUY', '1000', '2026-01-10', '100'),
      tx('VALUATION', '1500', '2026-03-01'),
      tx('SELL', '750', '2026-03-10', '50'),
    ]);
    expect(s.quantity?.toFixed(0)).toBe('50');
    expect(fixed(s.investedAmount)).toBe('500.00');
    expect(fixed(s.realizedGain)).toBe('250.00');
    expect(fixed(s.currentValue)).toBe('750.00');
    expect(s.averagePrice?.toFixed(2)).toBe('10.00');
    expect(profitOf(s)).toEqual({ profit: d('500'), profitPercent: 100 });
  });

  it('SELL por valor (sem cotas) é proporcional ao valor atual', () => {
    const s = replay([
      tx('BUY', '1000', '2026-01-01'),
      tx('VALUATION', '1250', '2026-02-01'),
      tx('SELL', '500', '2026-02-10'),
    ]);
    expect([fixed(s.investedAmount), fixed(s.realizedGain), fixed(s.currentValue)]).toEqual([
      '600.00',
      '100.00',
      '750.00',
    ]);
    expect(s.quantity).toBeNull();
  });

  it('dividendos, juros e taxas compõem income; valuation fixa o valor atual', () => {
    const s = replay([
      tx('BUY', '1000', '2026-01-01', '10'),
      tx('DIVIDEND', '30', '2026-02-01'),
      tx('INTEREST', '5.50', '2026-02-02'),
      tx('FEE', '2.50', '2026-02-03'),
      tx('VALUATION', '1100', '2026-02-28'),
    ]);
    expect(fixed(s.income)).toBe('33.00');
    expect(s.lastValuationAt).toBe('2026-02-28');
    expect(profitOf(s)).toEqual({ profit: d('133'), profitPercent: 13.3 });
  });

  it('vender mais que a posição lança erro; ordem por data (inclusive após remoção)', () => {
    expect(() =>
      replay([tx('BUY', '100', '2026-01-01', '1'), tx('SELL', '300', '2026-01-02', '2')]),
    ).toThrow(InsufficientPositionError);
    expect(() => replay([tx('BUY', '100', '2026-01-01'), tx('SELL', '101', '2026-01-02')])).toThrow(
      InsufficientPositionError,
    );
    // Fora de ordem cronológica no array: o replay ordena.
    const s = replay([tx('SELL', '50', '2026-02-01'), tx('BUY', '100', '2026-01-01')]);
    expect(fixed(s.currentValue)).toBe('50.00');
    // "Excluir" a compra torna a venda inválida.
    expect(() => replay([tx('SELL', '50', '2026-02-01')])).toThrow(InsufficientPositionError);
    expect(profitOf(replay([])).profitPercent).toBeNull();
  });

  it('série mensal: valor/custo no fim do mês e aportes líquidos', () => {
    const series = monthlySeries(
      [
        tx('BUY', '1000', '2026-01-10'),
        tx('VALUATION', '1100', '2026-02-15'),
        tx('BUY', '500', '2026-03-01'),
        tx('SELL', '200', '2026-03-20'),
      ],
      ['2025-12', '2026-01', '2026-02', '2026-03'],
    );
    expect(
      series.map((p) => [p.month, fixed(p.value), fixed(p.invested), fixed(p.contributions)]),
    ).toEqual([
      ['2025-12', '0.00', '0.00', '0.00'],
      ['2026-01', '1000.00', '1000.00', '1000.00'],
      ['2026-02', '1100.00', '1000.00', '0.00'],
      ['2026-03', '1400.00', '1312.50', '300.00'], // venda de 200 ÷ 1600 baixa 12,5% do custo
    ]);
  });
});
