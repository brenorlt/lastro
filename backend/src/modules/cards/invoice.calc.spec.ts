import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { installmentDates } from '../transactions/schedule.js';
import {
  clampDay,
  invoiceDates,
  invoiceFor,
  invoiceStatus,
  limitUsage,
  monthLabel,
} from './invoice.calc.js';
import { invoiceDelta, invoiceEffects } from './invoice-writer.js';

const d = (v: string) => new Decimal(v);

describe('ciclo da fatura', () => {
  it('fechamento antes do vencimento: mesmo mês', () => {
    expect(invoiceDates({ closingDay: 3, dueDay: 10 }, '2026-10')).toEqual({
      closingDate: '2026-10-03',
      dueDate: '2026-10-10',
    });
  });

  it('fechamento ≥ vencimento: fecha no mês anterior', () => {
    expect(invoiceDates({ closingDay: 25, dueDay: 5 }, '2026-10')).toEqual({
      closingDate: '2026-09-25',
      dueDate: '2026-10-05',
    });
    expect(invoiceDates({ closingDay: 10, dueDay: 10 }, '2026-10')).toEqual({
      closingDate: '2026-09-10',
      dueDate: '2026-10-10',
    });
  });

  it('dias inexistentes são limitados ao fim do mês', () => {
    expect(clampDay('2026-02', 31)).toBe('2026-02-28');
    expect(clampDay('2028-02', 30)).toBe('2028-02-29');
    expect(invoiceDates({ closingDay: 31, dueDay: 8 }, '2026-03')).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-03-08',
    });
    expect(invoiceDates({ closingDay: 30, dueDay: 31 }, '2026-02')).toEqual({
      closingDate: '2026-02-28',
      dueDate: '2026-02-28',
    });
  });

  it('invoiceFor: véspera do fechamento, no dia do fechamento (melhor dia) e depois', () => {
    const card = { closingDay: 3, dueDay: 10 };
    expect(invoiceFor(card, '2026-10-02')).toBe('2026-10');
    expect(invoiceFor(card, '2026-10-03')).toBe('2026-11');
    expect(invoiceFor(card, '2026-10-04')).toBe('2026-11');
    const late = { closingDay: 25, dueDay: 5 };
    expect(invoiceFor(late, '2026-09-24')).toBe('2026-10');
    expect(invoiceFor(late, '2026-09-25')).toBe('2026-11');
    expect(invoiceFor(late, '2026-12-31')).toBe('2027-02'); // fechou em 25/12
    expect(invoiceFor({ closingDay: 31, dueDay: 8 }, '2026-02-28')).toBe('2026-04');
  });

  it('parcelas mensais caem em faturas consecutivas', () => {
    const card = { closingDay: 3, dueDay: 10 };
    const refs = installmentDates('2026-01-31', 4).map((date) => invoiceFor(card, date));
    expect(refs).toEqual(['2026-02', '2026-03', '2026-04', '2026-05']);
    const onClosing = installmentDates('2026-10-03', 3).map((date) => invoiceFor(card, date));
    expect(onClosing).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('rótulo pt-BR', () => {
    expect(monthLabel('2026-09')).toBe('set/2026');
  });
});

describe('status da fatura', () => {
  const dates = { closingDate: '2026-10-03', dueDate: '2026-10-10' };
  const status = (today: string, total: string, paid: string) =>
    invoiceStatus({ ...dates, total: d(total), paidAmount: d(paid) }, today);

  it('OPEN → CLOSED → OVERDUE conforme a data; PAID quando quitada', () => {
    expect(status('2026-10-02', '100', '0')).toBe('OPEN');
    expect(status('2026-10-03', '100', '0')).toBe('CLOSED');
    expect(status('2026-10-10', '100', '40')).toBe('CLOSED');
    expect(status('2026-10-11', '100', '40')).toBe('OVERDUE');
    expect(status('2026-10-11', '100', '100')).toBe('PAID');
    expect(status('2026-10-01', '100', '100')).toBe('PAID'); // antecipada
    expect(status('2026-10-01', '0', '0')).toBe('OPEN');
    expect(status('2026-10-05', '0', '0')).toBe('PAID');
  });
});

describe('limite e efeitos', () => {
  it('limite usado considera o em aberto de todas as faturas', () => {
    expect(
      limitUsage(d('1000'), [
        { total: d('300'), paidAmount: d('300') },
        { total: d('500'), paidAmount: d('100') },
        { total: d('800'), paidAmount: d('0') },
      ]),
    ).toEqual({
      limitUsed: d('1200'),
      availableLimit: d('-200'),
      usagePercent: 120,
      overLimit: true,
    });
  });

  it('compra soma no total (qualquer status); pagamento soma no pago só quando CLEARED', () => {
    const purchase = {
      type: 'EXPENSE' as const,
      status: 'PENDING' as const,
      amount: '50',
      creditCardId: 'c',
      invoiceId: 'i1',
    };
    expect(invoiceEffects(purchase).get('i1')?.total.toFixed(2)).toBe('50.00');
    const payment = {
      type: 'TRANSFER' as const,
      status: 'CLEARED' as const,
      amount: '30',
      creditCardId: 'c',
      invoiceId: 'i1',
    };
    expect(invoiceEffects(payment).get('i1')?.paid.toFixed(2)).toBe('30.00');
    expect(invoiceEffects({ ...payment, status: 'PENDING' }).size).toBe(0);

    const moved = invoiceDelta([purchase, { ...purchase, invoiceId: 'i2', amount: '70' }]);
    expect(moved.get('i1')?.total.toFixed(2)).toBe('-50.00');
    expect(moved.get('i2')?.total.toFixed(2)).toBe('70.00');
    expect(
      invoiceDelta([purchase, { ...purchase, creditCardId: null, invoiceId: null }])
        .get('i1')
        ?.total.toFixed(2),
    ).toBe('-50.00');
    expect(invoiceDelta([purchase, purchase]).size).toBe(0);
  });
});
