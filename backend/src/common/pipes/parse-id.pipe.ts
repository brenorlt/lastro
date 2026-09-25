import { Injectable, type PipeTransform } from '@nestjs/common';
import { isUuid } from '../../auth/tokens/token.util.js';
import { AppException } from '../errors/app.exception.js';
import type { ErrorCode } from '../errors/error-codes.js';

/** Valida `:id` como UUID; ids malformados respondem o 404 do domínio (sem vazar formato). */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  constructor(private readonly notFoundCode: ErrorCode) {}

  transform(value: string): string {
    if (typeof value !== 'string' || !isUuid(value)) throw new AppException(this.notFoundCode);
    return value.toLowerCase();
  }
}
