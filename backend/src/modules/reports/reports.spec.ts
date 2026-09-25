import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { buildCsv, csvDate, csvMoney, escapeCsvText } from './csv.js';
import {
  effectiveGranularity,
  enumeratePeriods,
  periodKey,
  previousWindow,
  resolveRange,
} from './report-period.js';
import { date, int, money, percent, text } from './report-table.js';
import { buildCategoryReport } from './reports.calc.js';

describe('CSV', () => {
  it('BOM, ";", CRLF, vírgula decimal e datas dd/mm/aaaa', () => {
    const csv = buildCsv({
      columns: [
        { header: 'Data' },
        { header: 'Descrição' },
        { header: 'Valor' },
        { header: '%' },
        { header: 'Qtd' },
      ],
      rows: [
        [date('2026-09-24'), text('Mercado; feira'), money('-1234.5'), percent(35.6), int(3)],
        [date(null), text('Diz "oi"\nlinha 2'), money('0'), percent(null), int(0)],
      ],
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Data;Descrição;Valor;%;Qtd',
      '24/09/2026;"Mercado; feira";-1234,50;35,6;3',
      ';"Diz ""oi""\nlinha 2";0,00;;0',
      '',
    ]);
  });

  it('neutraliza fórmulas em textos, mas não em números gerados', () => {
    expect(escapeCsvText('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(escapeCsvText('+55 11')).toBe("'+55 11");
    expect(escapeCsvText('-10')).toBe("'-10");
    expect(escapeCsvText('@cmd')).toBe("'@cmd");
    expect(escapeCsvText('\tx')).toBe("'\tx");
    expect(escapeCsvText('Normal')).toBe('Normal');
    expect(csvMoney('-35.9')).toBe('-35,90');
    expect(csvDate('2026-01-05')).toBe('05/01/2026');
  });
});

describe('períodos', () => {
  it('padrão = mês atual; valida ordem e 5 anos', () => {
    expect(resolveRange(undefined, undefined, '2026-09-24')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolveRange('2026-02-10', undefined, '2026-09-24')).toEqual({
      from: '2026-02-10',
      to: '2026-02-28',
    });
    expect(() => resolveRange('2026-03-01', '2026-02-01', '2026-09-24')).toThrow();
    expect(() => resolveRange('2020-01-01', '2025-01-02', '2026-09-24')).toThrow();
    expect(resolveRange('2021-01-01', '2025-12-31', '2026-09-24').to).toBe('2025-12-31');
  });

  it('janela anterior de mesmo tamanho', () => {
    expect(previousWindow('2026-09-01', '2026-09-30')).toEqual({
      from: '2026-08-02',
      to: '2026-08-31',
    });
    expect(previousWindow('2026-03-01', '2026-03-31')).toEqual({
      from: '2026-01-29',
      to: '2026-02-28',
    });
  });

  it('granularidade diária só até 92 dias; semanas ISO; zero-fill', () => {
    expect(effectiveGranularity('day', '2026-01-01', '2026-04-02')).toBe('day');
    expect(effectiveGranularity('day', '2026-01-01', '2026-04-03')).toBe('month');
    expect(periodKey('2026-01-01', 'week')).toBe('2026-W01');
    expect(periodKey('2027-01-01', 'week')).toBe('2026-W53');
    expect(periodKey('2026-12-31', 'week')).toBe('2026-W53');
    expect(enumeratePeriods('2026-09-28', '2026-10-06', 'week').map((p) => p.period)).toEqual([
      '2026-W40',
      '2026-W41',
    ]);
    expect(
      enumeratePeriods('2026-01-15', '2026-03-02', 'month').map((p) => [p.period, p.label]),
    ).toEqual([
      ['2026-01', 'jan/2026'],
      ['2026-02', 'fev/2026'],
      ['2026-03', 'mar/2026'],
    ]);
    expect(enumeratePeriods('2026-09-29', '2026-10-01', 'day').map((p) => p.label)).toEqual([
      '29/09',
      '30/09',
      '01/10',
    ]);
  });
});

describe('relatório de categorias', () => {
  it('agrupa na raiz com filhos e compara com o período anterior', () => {
    const d = (v: string) => new Decimal(v);
    const categories = new Map([
      [
        'food',
        { id: 'food', name: 'Alimentação', color: '#f00', icon: 'utensils', parentId: null },
      ],
      ['market', { id: 'market', name: 'Mercado', color: '#0f0', icon: 'store', parentId: 'food' }],
      ['home', { id: 'home', name: 'Moradia', color: '#00f', icon: 'house', parentId: null }],
    ]);
    const report = buildCategoryReport(
      new Map<string | null, { amount: Decimal; count: number }>([
        ['food', { amount: d('100'), count: 1 }],
        ['market', { amount: d('300'), count: 3 }],
        ['home', { amount: d('500'), count: 1 }],
        [null, { amount: d('100'), count: 2 }],
      ]),
      new Map<string | null, { amount: Decimal; count: number }>([
        ['market', { amount: d('200'), count: 2 }],
        ['home', { amount: d('0'), count: 0 }],
      ]),
      categories,
    );
    expect(report.total).toBe('1000.00');
    expect(
      report.rows.map((r) => [r.name, r.amount, r.share, r.count, r.previousAmount, r.change]),
    ).toEqual([
      ['Moradia', '500.00', 50, 1, '0.00', null],
      ['Alimentação', '400.00', 40, 4, '200.00', 100],
      ['Sem categoria', '100.00', 10, 2, '0.00', null],
    ]);
    expect(report.rows[1].children?.map((c) => [c.name, c.amount, c.change])).toEqual([
      ['Mercado', '300.00', 50],
    ]);
  });
});
