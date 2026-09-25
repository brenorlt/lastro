import { describe, expect, it } from '@jest/globals';
import { AppException } from '../errors/app.exception.js';
import {
  addMoney,
  Decimal,
  formatMoney,
  isPositiveMoney,
  multiplyMoney,
  percentageOf,
  roundMoney,
  splitInstallments,
  subtractMoney,
  toDecimal,
  toMoneyString,
} from './money.js';

describe('money util', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(addMoney('0.1', '0.2').toString()).toBe('0.3');
    expect(addMoney(0.1, 0.2).equals(new Decimal('0.3'))).toBe(true);
    expect(addMoney().toString()).toBe('0');
  });

  it('subtrai e multiplica arredondando para centavos (half-up)', () => {
    expect(subtractMoney('100.00', '33.33').toFixed(2)).toBe('66.67');
    expect(multiplyMoney('10.005', 1).toFixed(2)).toBe('10.01');
    expect(multiplyMoney('19.99', 3).toFixed(2)).toBe('59.97');
    expect(roundMoney('2.345').toFixed(2)).toBe('2.35');
  });

  it('rejeita entradas inválidas', () => {
    expect(() => toDecimal('abc')).toThrow(AppException);
    expect(() => toDecimal('1,50')).toThrow(AppException);
    expect(() => toDecimal(Number.NaN)).toThrow(AppException);
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(AppException);
  });

  it('divide parcelas sem perder centavos', () => {
    const parts = splitInstallments('100.00', 3).map((p) => p.toFixed(2));
    expect(parts).toEqual(['33.34', '33.33', '33.33']);
    expect(addMoney(...splitInstallments('100.00', 3)).toFixed(2)).toBe('100.00');
    expect(() => splitInstallments('10', 0)).toThrow(AppException);
  });

  it('calcula percentuais e trata total zero', () => {
    expect(percentageOf('80', '200').toString()).toBe('40');
    expect(percentageOf('10', '0').toString()).toBe('0');
  });

  it('serializa e formata', () => {
    expect(toMoneyString('1234.5')).toBe('1234.50');
    expect(isPositiveMoney('0.01')).toBe(true);
    expect(isPositiveMoney('0')).toBe(false);
    expect(formatMoney('1234.5').replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });
});
