import { describe, expect, it } from '@jest/globals';
import { addMoney, splitInstallments } from '../../common/utils/money.js';
import { installmentDates, nextOccurrenceAfter, recurrenceDates } from './schedule.js';

describe('parcelas', () => {
  it('10× de 1000.00 somam exatamente e começam em 31/01 com ajuste de fim de mês', () => {
    const amounts = splitInstallments('1000.00', 10).map((a) => a.toFixed(2));
    expect(amounts).toEqual(Array(10).fill('100.00'));
    const odd = splitInstallments('100.00', 3);
    expect(odd.map((a) => a.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
    expect(addMoney(...odd).toFixed(2)).toBe('100.00');

    expect(installmentDates('2026-01-31', 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
});

describe('recorrência', () => {
  const until = '2026-12-31';

  it('diária com intervalo e horizonte', () => {
    expect(
      recurrenceDates({ start: '2026-12-25', frequency: 'DAILY', interval: 2, until }),
    ).toEqual(['2026-12-25', '2026-12-27', '2026-12-29', '2026-12-31']);
  });

  it('semanal respeita endDate', () => {
    expect(
      recurrenceDates({
        start: '2026-12-01',
        frequency: 'WEEKLY',
        interval: 1,
        endDate: '2026-12-20',
        until,
      }),
    ).toEqual(['2026-12-01', '2026-12-08', '2026-12-15']);
  });

  it('mensal com dia-âncora 31 e cursor `after` (idempotência)', () => {
    const all = recurrenceDates({
      start: '2026-01-31',
      frequency: 'MONTHLY',
      interval: 1,
      until: '2026-05-31',
    });
    expect(all).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(
      recurrenceDates({
        start: '2026-01-31',
        frequency: 'MONTHLY',
        interval: 1,
        until: '2026-05-31',
        after: '2026-03-31',
      }),
    ).toEqual(['2026-04-30', '2026-05-31']);
  });

  it('bimestral e anual (29/02)', () => {
    expect(
      recurrenceDates({
        start: '2026-01-15',
        frequency: 'MONTHLY',
        interval: 2,
        until: '2026-07-01',
      }),
    ).toEqual(['2026-01-15', '2026-03-15', '2026-05-15']);
    expect(
      recurrenceDates({
        start: '2028-02-29',
        frequency: 'YEARLY',
        interval: 1,
        until: '2032-03-01',
      }),
    ).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  });

  it('limite e próxima ocorrência', () => {
    expect(
      recurrenceDates({ start: '2020-01-01', frequency: 'DAILY', interval: 1, until, limit: 5 }),
    ).toHaveLength(5);
    expect(nextOccurrenceAfter('2026-01-31', 'MONTHLY', 1, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrenceAfter('2026-01-31', 'MONTHLY', 1, '2026-02-28', '2026-03-01')).toBeNull();
  });
});
