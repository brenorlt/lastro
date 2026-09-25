import { describe, expect, it } from '@jest/globals';
import { todayIn } from '../../common/utils/date-only.js';
import {
  billStage,
  cooledDown,
  invoiceStages,
  isFirstOfMonth,
  isMonday,
  isoWeek,
  previousWeek,
} from './notification-rules.js';

describe('regras de notificação', () => {
  it('estágios de contas a pagar', () => {
    expect(billStage('2026-09-27', '2026-09-24')).toBe('IN_3_DAYS');
    expect(billStage('2026-09-24', '2026-09-24')).toBe('TODAY');
    expect(billStage('2026-09-23', '2026-09-24')).toBe('YESTERDAY');
    expect(billStage('2026-09-25', '2026-09-24')).toBeNull();
    expect(billStage('2026-09-20', '2026-09-24')).toBeNull();
  });

  it('estágios de fatura', () => {
    const base = {
      closingDate: '2026-09-17',
      dueDate: '2026-09-24',
      hasRemaining: true,
      total: 100,
    };
    expect(invoiceStages({ ...base, dueDate: '2026-09-29' }, '2026-09-24')).toEqual(['IN_5_DAYS']);
    expect(invoiceStages(base, '2026-09-24')).toEqual(['DUE_TODAY']);
    expect(invoiceStages(base, '2026-09-25')).toEqual(['OVERDUE']);
    expect(invoiceStages(base, '2026-09-26')).toEqual([]);
    expect(invoiceStages({ ...base, hasRemaining: false }, '2026-09-24')).toEqual([]);
    expect(invoiceStages(base, '2026-09-17')).toEqual(['CLOSED_TODAY']);
    expect(invoiceStages({ ...base, total: 0, hasRemaining: false }, '2026-09-17')).toEqual([]);
  });

  it('datas no fuso do usuário: segunda-feira, dia 1 e semana anterior', () => {
    const instant = new Date('2026-09-28T02:00:00Z'); // domingo 23h em São Paulo, segunda em UTC
    expect(isMonday(todayIn('America/Sao_Paulo', instant))).toBe(false);
    expect(isMonday(todayIn('UTC', instant))).toBe(true);
    expect(isFirstOfMonth(todayIn('America/Sao_Paulo', new Date('2026-10-01T02:00:00Z')))).toBe(
      false,
    );
    expect(isFirstOfMonth('2026-10-01')).toBe(true);
    expect(previousWeek('2026-09-28')).toEqual({
      from: '2026-09-21',
      to: '2026-09-27',
      week: '2026-W39',
    });
    expect(previousWeek('2026-10-01')).toEqual({
      from: '2026-09-21',
      to: '2026-09-27',
      week: '2026-W39',
    });
    expect(isoWeek('2026-09-28')).toBe('2026-W40');
  });

  it('intervalo mínimo entre avisos', () => {
    const now = new Date('2026-09-24T12:00:00Z');
    expect(cooledDown(null, now, 30)).toBe(true);
    expect(cooledDown(new Date('2026-09-01T12:00:00Z'), now, 30)).toBe(false);
    expect(cooledDown(new Date('2026-08-25T12:00:00Z'), now, 30)).toBe(true);
  });
});
