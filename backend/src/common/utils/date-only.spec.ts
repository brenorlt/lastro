import { describe, expect, it } from '@jest/globals';
import {
  addDays,
  addMonthsClamped,
  fromDbDate,
  isValidDateOnly,
  todayIn,
  toDbDate,
} from './date-only.js';

describe('date-only utils', () => {
  it('todayIn respeita o fuso do usuário', () => {
    const instant = new Date('2026-01-01T02:30:00Z'); // 23:30 de 31/12 em São Paulo
    expect(todayIn('America/Sao_Paulo', instant)).toBe('2025-12-31');
    expect(todayIn('UTC', instant)).toBe('2026-01-01');
    expect(todayIn('Asia/Tokyo', new Date('2026-06-30T16:00:00Z'))).toBe('2026-07-01');
  });

  it('addMonthsClamped ajusta ao fim do mês preservando o dia-âncora', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('addDays atravessa meses/anos e DST sem desvio', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-31', 7)).toBe('2026-11-07');
  });

  it('valida e converte datas', () => {
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('26-01-01')).toBe(false);
    expect(isValidDateOnly(20260101)).toBe(false);
    expect(fromDbDate(toDbDate('2026-09-24'))).toBe('2026-09-24');
  });
});
