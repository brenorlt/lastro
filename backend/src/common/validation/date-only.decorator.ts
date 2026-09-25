import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidDateOnly } from '../utils/date-only.js';

/** Data `YYYY-MM-DD` válida no calendário (1900–2200). */
export function IsDateOnly(options: ValidationOptions = {}): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: 'Data inválida: use o formato AAAA-MM-DD', ...options },
      validator: { validate: (value: unknown) => isValidDateOnly(value) },
    });
}
