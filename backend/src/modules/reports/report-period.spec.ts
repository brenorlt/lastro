import { describe, expect, it } from '@jest/globals';
import { monthsSpanned } from './report-period.js';

describe('monthsSpanned (calendário)', () => {
  it('meses completos contam exatamente', () => {
    expect(monthsSpanned('2026-07-01', '2026-09-30')).toBe(3);
    expect(monthsSpanned('2026-02-01', '2026-02-28')).toBe(1);
  });
  it('meses parciais contam a fração de dias', () => {
    expect(monthsSpanned('2026-09-16', '2026-09-30')).toBe(1);
    expect(monthsSpanned('2026-08-17', '2026-09-30')).toBeCloseTo(15 / 31 + 1, 6);
  });
});
