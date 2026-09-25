import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

export const MONEY_REGEX = /^-?\d{1,15}(\.\d{1,2})?$/;
export const NON_NEGATIVE_MONEY_REGEX = /^\d{1,15}(\.\d{1,2})?$/;
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
export const ICON_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Valor monetário como string decimal ("1520.40"), até 15 dígitos inteiros e 2 casas.
 * Negativos só com `allowNegative`.
 */
export function IsMoneyString(options: { allowNegative?: boolean } = {}): PropertyDecorator {
  const regex = options.allowNegative ? MONEY_REGEX : NON_NEGATIVE_MONEY_REGEX;
  return applyDecorators(
    IsString({ message: 'O valor deve ser enviado como texto decimal (ex.: "1520.40")' }),
    Matches(regex, {
      message: options.allowNegative
        ? 'Valor inválido: use até 2 casas decimais com ponto (ex.: "-35.90")'
        : 'Valor inválido: use um número não negativo com até 2 casas decimais (ex.: "1520.40")',
    }),
  );
}

export function IsHexColor(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'Cor inválida' }),
    Matches(HEX_COLOR_REGEX, { message: 'Cor inválida: use o formato #RRGGBB' }),
  );
}

/** Nome de ícone lucide em kebab-case. */
export function IsIconName(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: 'Ícone inválido' }),
    MaxLength(40, { message: 'Ícone inválido' }),
    Matches(ICON_NAME_REGEX, { message: 'Ícone inválido: use um nome lucide em kebab-case' }),
  );
}
