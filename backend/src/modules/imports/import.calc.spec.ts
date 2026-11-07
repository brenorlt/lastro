import { describe, expect, it } from '@jest/globals';
import { Decimal } from '../../common/utils/money.js';
import { keywordCategory, merchantKey } from '../categories/categorize.js';
import { autoInvert, buildPreview, type ExistingEntry, lineExternalIds } from './import.calc.js';
import type { StatementLine } from './parsers/statement.types.js';

const ACCOUNT = '11111111-1111-1111-1111-111111111111';
const line = (
  date: string,
  amount: string,
  description: string,
  fitId: string | null = null,
): StatementLine => ({
  date,
  amount: new Decimal(amount),
  description,
  fitId,
});
const noSuggestion = () => null;

describe('lineExternalIds', () => {
  it('linhas idênticas no mesmo arquivo recebem ids diferentes e estáveis', () => {
    const lines = [line('2026-09-02', '-8.00', 'CAFE'), line('2026-09-02', '-8.00', 'CAFE')];
    const ids = lineExternalIds('ACCOUNT', ACCOUNT, lines);
    expect(ids[0]).not.toBe(ids[1]);
    expect(lineExternalIds('ACCOUNT', ACCOUNT, lines)).toEqual(ids);
    expect(ids[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ignora dígitos da descrição, mas depende do destino', () => {
    const [a] = lineExternalIds('ACCOUNT', ACCOUNT, [line('2026-09-02', '-8.00', 'UBER 12/09')]);
    const [b] = lineExternalIds('ACCOUNT', ACCOUNT, [line('2026-09-02', '-8.00', 'UBER 13/09')]);
    const [c] = lineExternalIds('CARD', ACCOUNT, [line('2026-09-02', '-8.00', 'UBER 12/09')]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('buildPreview', () => {
  const lines = [
    line('2026-09-02', '-45.90', 'PADARIA'),
    line('2026-09-05', '5000.00', 'SALARIO'),
    line('2026-09-06', '-120.00', 'MERCADO'),
  ];

  it('classifica tipo e ordena do mais recente para o mais antigo', () => {
    const rows = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines,
      invert: false,
      existing: [],
      suggest: noSuggestion,
    });
    expect(rows.map((r) => [r.date, r.type, r.amount, r.status])).toEqual([
      ['2026-09-06', 'EXPENSE', '120.00', 'NEW'],
      ['2026-09-05', 'INCOME', '5000.00', 'NEW'],
      ['2026-09-02', 'EXPENSE', '45.90', 'NEW'],
    ]);
  });

  it('marca já importadas pelo id e não as usa como candidatas a duplicata', () => {
    const [id] = lineExternalIds('ACCOUNT', ACCOUNT, lines);
    const existing: ExistingEntry[] = [
      { date: '2026-09-02', signed: new Decimal('-45.90'), externalId: id },
    ];
    const rows = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines,
      invert: false,
      existing,
      suggest: noSuggestion,
    });
    expect(rows.find((r) => r.description === 'PADARIA')?.status).toBe('IMPORTED');
    expect(rows.filter((r) => r.status === 'NEW')).toHaveLength(2);
  });

  it('possível duplicata: mesmo valor em até 3 dias, cada existente casa com uma linha só', () => {
    const twoCoffees = [line('2026-09-02', '-8.00', 'CAFE'), line('2026-09-02', '-8.00', 'CAFE')];
    const existing: ExistingEntry[] = [
      { date: '2026-09-04', signed: new Decimal('-8.00'), externalId: null },
    ];
    const rows = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines: twoCoffees,
      invert: false,
      existing,
      suggest: noSuggestion,
    });
    expect(rows.map((r) => r.status).sort()).toEqual(['DUPLICATE', 'NEW']);

    const far: ExistingEntry[] = [
      { date: '2026-09-06', signed: new Decimal('-8.00'), externalId: null },
    ];
    const farRows = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines: twoCoffees,
      invert: false,
      existing: far,
      suggest: noSuggestion,
    });
    expect(farRows.every((r) => r.status === 'NEW')).toBe(true);
  });

  it('não casa duplicata de sinal oposto (estorno ≠ compra)', () => {
    const existing: ExistingEntry[] = [
      { date: '2026-09-02', signed: new Decimal('45.90'), externalId: null },
    ];
    const rows = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines,
      invert: false,
      existing,
      suggest: noSuggestion,
    });
    expect(rows.every((r) => r.status === 'NEW')).toBe(true);
  });

  it('cartão: créditos (pagamento/estorno) não são importáveis', () => {
    const card = [
      line('2026-09-10', '-89.90', 'NETFLIX'),
      line('2026-09-15', '500.00', 'PAGAMENTO RECEBIDO'),
    ];
    const rows = buildPreview({
      targetKind: 'CARD',
      targetId: ACCOUNT,
      lines: card,
      invert: false,
      existing: [],
      suggest: noSuggestion,
    });
    expect(rows.map((r) => [r.description, r.type, r.status])).toEqual([
      ['PAGAMENTO RECEBIDO', 'INCOME', 'UNSUPPORTED'],
      ['NETFLIX', 'EXPENSE', 'NEW'],
    ]);
  });

  it('inverter sinais troca o tipo sem mudar a identidade da linha', () => {
    const normal = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines,
      invert: false,
      existing: [],
      suggest: noSuggestion,
    });
    const inverted = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines,
      invert: true,
      existing: [],
      suggest: noSuggestion,
    });
    expect(inverted.map((r) => r.type)).toEqual(['INCOME', 'EXPENSE', 'INCOME']);
    expect(inverted.map((r) => r.externalId)).toEqual(normal.map((r) => r.externalId));
  });

  it('usa a sugestão de categoria só para linhas importáveis', () => {
    const suggest = (d: string) => (d === 'MERCADO' ? 'cat-1' : null);
    const rows = buildPreview({
      targetKind: 'ACCOUNT',
      targetId: ACCOUNT,
      lines,
      invert: false,
      existing: [],
      suggest,
    });
    expect(rows.find((r) => r.description === 'MERCADO')?.categoryId).toBe('cat-1');
  });
});

describe('autoInvert', () => {
  const statement = (amounts: string[], format: 'OFX' | 'CSV') => ({
    format,
    kind: null,
    balance: null,
    lines: amounts.map((a) => line('2026-09-01', a, 'X')),
  });

  it('só inverte CSV de cartão com maioria positiva (compras positivas, ex.: Nubank)', () => {
    expect(autoInvert('CARD', statement(['10', '20', '-5'], 'CSV'))).toBe(true);
    expect(autoInvert('CARD', statement(['-10', '-20', '5'], 'CSV'))).toBe(false);
    expect(autoInvert('CARD', statement(['10', '20'], 'OFX'))).toBe(false);
    expect(autoInvert('ACCOUNT', statement(['10', '20'], 'CSV'))).toBe(false);
  });
});

describe('categorização por palavra-chave', () => {
  it.each([
    ['UBER *TRIP 12/09', 'EXPENSE', 'Transporte'],
    ['IFOOD *RESTAURANTE', 'EXPENSE', 'Alimentação'],
    ['AMAZON PRIME CANAIS', 'EXPENSE', 'Assinaturas'],
    ['AMAZON MARKETPLACE', 'EXPENSE', 'Compras'],
    ['MERCADO LIVRE*VENDEDOR', 'EXPENSE', 'Compras'],
    ['SUPERMERCADO DIA', 'EXPENSE', 'Alimentação'],
    ['DROGASIL 123', 'EXPENSE', 'Saúde'],
    ['CRÉDITO SALÁRIO', 'INCOME', 'Salário'],
    ['PIX ENVIADO JOAO', 'EXPENSE', null],
    ['UBER', 'INCOME', null],
  ] as const)('%s (%s) → %s', (description, type, expected) =>
    expect(keywordCategory(description, type)).toBe(expected),
  );

  it('merchantKey remove dígitos, acentos e pontuação', () => {
    expect(merchantKey('Pão de Açúcar - Loja 123')).toBe('pao de acucar loja');
  });
});
