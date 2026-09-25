import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { ErrorResponse } from '../common/types/http.js';
import { validationExceptionFactory } from '../common/validation/validation-exception.factory.js';
import type { AppConfigService } from '../config/app-config.service.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

interface CapturedResponse {
  statusCode?: number;
  body?: ErrorResponse;
  headers: Record<string, string>;
}

function createHost(captured: CapturedResponse, requestId = 'req-test-123'): ArgumentsHost {
  const response = {
    headersSent: false,
    setHeader: (name: string, value: string) => {
      captured.headers[name] = value;
    },
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: ErrorResponse) {
      captured.body = body;
      return this;
    },
  };
  const request = {
    method: 'GET',
    url: '/api/accounts/1',
    originalUrl: '/api/accounts/1',
    headers: { 'x-request-id': requestId },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function run(exception: unknown, isProductionLike: boolean): CapturedResponse {
  const config = { isProductionLike } as AppConfigService;
  const captured: CapturedResponse = { headers: {} };
  new AllExceptionsFilter(config).catch(exception, createHost(captured));
  return captured;
}

class FakePrismaError extends Error {
  constructor(
    readonly code: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super('Invalid `prisma.account.create()` invocation: internal details');
    this.name = 'PrismaClientKnownRequestError';
  }
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('produz o envelope de erro exato para AppException', () => {
    const { statusCode, body, headers } = run(new AppException(ErrorCode.ACCOUNT_NOT_FOUND), true);

    expect(statusCode).toBe(404);
    expect(headers['x-request-id']).toBe('req-test-123');
    expect(body).toEqual({
      success: false,
      message: 'Conta não encontrada',
      code: 'ACCOUNT_NOT_FOUND',
      statusCode: 404,
      path: '/api/accounts/1',
      timestamp: expect.any(String),
      requestId: 'req-test-123',
    });
    expect(Object.keys(body ?? {})).not.toContain('details');
  });

  it('mapeia erros do class-validator para VALIDATION_ERROR com detalhes por campo', () => {
    const exception = validationExceptionFactory([
      {
        property: 'name',
        constraints: { isNotEmpty: 'name não pode ser vazio' },
        children: [],
      },
      {
        property: 'address',
        children: [
          { property: 'zip', constraints: { isPostalCode: 'CEP inválido' }, children: [] },
        ],
      },
    ]);
    const { statusCode, body } = run(exception, true);

    expect(statusCode).toBe(400);
    expect(body?.code).toBe('VALIDATION_ERROR');
    expect(body?.message).toBe('Dados inválidos');
    expect(body?.details).toEqual([
      { field: 'name', message: 'name não pode ser vazio', constraint: 'isNotEmpty' },
      { field: 'address.zip', message: 'CEP inválido', constraint: 'isPostalCode' },
    ]);
  });

  it('mapeia ThrottlerException para RATE_LIMITED 429', () => {
    const { statusCode, body } = run(new ThrottlerException(), true);
    expect(statusCode).toBe(429);
    expect(body?.code).toBe('RATE_LIMITED');
  });

  it('traduz HttpException nativa do Nest para mensagem pt-BR', () => {
    expect(run(new NotFoundException('Cannot GET /x'), true).body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado',
      statusCode: 404,
    });
    expect(run(new BadRequestException(), true).body?.code).toBe('BAD_REQUEST');
  });

  it('mapeia Prisma P2002 para CONFLICT e P2025 para NOT_FOUND', () => {
    const conflict = run(new FakePrismaError('P2002', { target: ['email'] }), true);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body?.code).toBe('CONFLICT');
    expect(conflict.body?.details).toEqual([
      { field: 'email', message: 'Valor já utilizado', constraint: 'unique' },
    ]);

    const notFound = run(new FakePrismaError('P2025'), true);
    expect(notFound.statusCode).toBe(404);
    expect(notFound.body?.code).toBe('NOT_FOUND');
  });

  it('não vaza stack nem mensagem interna em produção, mas registra no log', () => {
    const error = new Error('connection string postgres://user:secret@db leaked');
    const { statusCode, body } = run(error, true);
    const serialized = JSON.stringify(body);

    expect(statusCode).toBe(500);
    expect(body?.code).toBe('INTERNAL_ERROR');
    expect(body?.message).toBe('Erro interno do servidor');
    expect(body?.details).toBeUndefined();
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('at ');
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('em development expõe só a mensagem interna (nunca o stack)', () => {
    const { body } = run(new Error('boom'), false);
    expect(body?.details).toEqual([{ message: 'boom', constraint: 'internal' }]);
    expect(JSON.stringify(body)).not.toContain('.ts:');
  });
});
