import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsHexColor, IsIconName, IsMoneyString } from './decorators.js';

class Sample {
  @IsMoneyString() amount: unknown;
  @IsMoneyString({ allowNegative: true }) balance: unknown;
  @IsHexColor() color: unknown;
  @IsIconName() icon: unknown;
}

const valid = { amount: '1520.40', balance: '-35.9', color: '#8B5CF6', icon: 'piggy-bank' };
const errorsFor = (patch: Partial<Record<keyof Sample, unknown>>) =>
  validateSync(plainToInstance(Sample, { ...valid, ...patch })).map((e) => e.property);

describe('decorators de validação', () => {
  it('aceita valores válidos', () => {
    expect(errorsFor({})).toEqual([]);
    expect(errorsFor({ amount: '0', balance: '999999999999999.99' })).toEqual([]);
  });

  it.each([
    ['número em vez de string', 10.5],
    ['3 casas', '1.234'],
    ['vírgula', '1,50'],
    ['negativo sem permissão', '-1.00'],
    ['16 dígitos', '1234567890123456'],
    ['vazio', ''],
    ['ponto solto', '10.'],
    ['notação científica', '1e5'],
  ])('rejeita money: %s', (_, amount) => {
    expect(errorsFor({ amount })).toEqual(['amount']);
  });

  it('negativo só com allowNegative', () => {
    expect(errorsFor({ balance: '-0.01' })).toEqual([]);
    expect(errorsFor({ balance: '--1' })).toEqual(['balance']);
  });

  it('valida cor #RRGGBB e ícone kebab-case', () => {
    expect(errorsFor({ color: '#fff' })).toEqual(['color']);
    expect(errorsFor({ color: 'red' })).toEqual(['color']);
    expect(errorsFor({ icon: 'PiggyBank' })).toEqual(['icon']);
    expect(errorsFor({ icon: 'piggy--bank' })).toEqual(['icon']);
    expect(errorsFor({ icon: 'a'.repeat(41) })).toEqual(['icon']);
  });
});
