import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ERROR_DEFINITIONS, type ErrorCode } from '../errors/error-codes.js';

/** Documenta a resposta de sucesso já envelopada: `{ success: true, data: <model> }`. */
export function ApiEnvelope(
  model: Type<unknown> | null,
  options: { status?: number; description?: string; isArray?: boolean } = {},
) {
  const status = options.status ?? 200;
  if (status === 204 || model === null) {
    return ApiResponse({ status, description: options.description ?? 'Sem conteúdo' });
  }
  const data = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description: options.description ?? 'Sucesso',
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: { success: { type: 'boolean', example: true }, data },
      },
    }),
  );
}

/** Documenta respostas de erro com exemplos do envelope padrão, agrupadas por status. */
export function ApiErrors(...codes: ErrorCode[]) {
  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const { status } = ERROR_DEFINITIONS[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  return applyDecorators(
    ...[...byStatus.entries()].map(([status, group]) =>
      ApiResponse({
        status,
        description: group.join(' | '),
        content: {
          'application/json': {
            examples: Object.fromEntries(
              group.map((code) => [
                code,
                {
                  value: {
                    success: false,
                    message: ERROR_DEFINITIONS[code].message,
                    code,
                    statusCode: status,
                    path: '/api/...',
                    timestamp: '2026-01-01T00:00:00.000Z',
                    requestId: '6f1c2b8e-3a4d-4c1e-9f0a-2b7c8d9e0f1a',
                  },
                },
              ]),
            ),
          },
        },
      }),
    ),
  );
}
