import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { SuccessResponse } from '../common/types/http.js';

/** Objeto com exatamente as chaves `data` e `meta` (ex.: retorno de `paginate()`). */
function isDataWithMeta(value: unknown): value is { data: unknown; meta: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('data') && keys.includes('meta');
}

/** Envelopa respostas de sucesso em `{ success: true, data, meta? }`. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      map((payload: unknown): unknown => {
        if (payload instanceof StreamableFile) return payload;

        if (isDataWithMeta(payload)) {
          const body: SuccessResponse<unknown, unknown> = {
            success: true,
            data: payload.data,
            meta: payload.meta,
          };
          return body;
        }

        const body: SuccessResponse<unknown> = { success: true, data: payload ?? null };
        return body;
      }),
    );
  }
}
