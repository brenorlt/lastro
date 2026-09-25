import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../src/common/dto/pagination-query.dto.js';
import type { AuthUser } from '../src/common/types/auth-user.js';
import { paginate } from '../src/common/utils/pagination.js';
import { createTestApp, type TestContext } from './support/test-app.js';

class EchoDto {
  @IsString()
  @IsNotEmpty({ message: 'name não pode ser vazio' })
  name: string;
}

/** Controller só de teste: rotas protegidas pelo JwtAuthGuard global. */
@Controller('__test')
class ProtectedTestController {
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Get('items')
  items(@Query() query: PaginationQueryDto) {
    return paginate(['a', 'b'], 42, query);
  }

  @Post('echo')
  echo(@Body() body: EchoDto) {
    return body;
  }
}

describe('Lastro API (e2e)', () => {
  let ctx: TestContext;
  let http: Server;
  let accessToken: string;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [ProtectedTestController] });
    http = ctx.http;
    const user = await ctx.createVerifiedUser('app');
    userId = user.id;
    ({ accessToken, sessionId } = await ctx.issueAccessToken(user.id));
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('GET /api/health', () => {
    it('retorna o envelope de sucesso com status do banco', async () => {
      const res = await request(http).get('/api/health').expect(200);

      expect(res.headers['x-request-id']).toEqual(expect.any(String));
      expect(res.body).toEqual({
        success: true,
        data: {
          status: 'ok',
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: 'test',
          checks: { database: { status: 'up', responseTimeMs: expect.any(Number) } },
        },
      });
    });

    it('liveness responde sem autenticação', async () => {
      const res = await request(http).get('/api/health/live').expect(200);
      expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
    });

    it('propaga um x-request-id válido enviado pelo cliente', async () => {
      const res = await request(http)
        .get('/api/health/live')
        .set('x-request-id', 'client-req-0001');
      expect(res.headers['x-request-id']).toBe('client-req-0001');
    });
  });

  describe('rotas protegidas', () => {
    it('sem token retorna 401 UNAUTHORIZED no envelope de erro', async () => {
      const res = await request(http)
        .get('/api/__test/me')
        .set('x-request-id', 'e2e-unauth-0001')
        .expect(401);

      expect(res.body).toEqual({
        success: false,
        message: 'Não autenticado',
        code: 'UNAUTHORIZED',
        statusCode: 401,
        path: '/api/__test/me',
        timestamp: expect.any(String),
        requestId: 'e2e-unauth-0001',
      });
    });

    it('token inválido retorna 401 TOKEN_INVALID', async () => {
      const res = await request(http)
        .get('/api/__test/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('token válido anexa { id, sessionId } em request.user', async () => {
      const res = await request(http)
        .get('/api/__test/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body).toEqual({
        success: true,
        data: { user: { id: userId, sessionId } },
      });
    });

    it('retorno paginado vira { success, data, meta }', async () => {
      const res = await request(http)
        .get('/api/__test/items?page=2&pageSize=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body).toEqual({
        success: true,
        data: ['a', 'b'],
        meta: {
          page: 2,
          pageSize: 10,
          total: 42,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });
    });

    it('validação retorna VALIDATION_ERROR com detalhes (whitelist + forbidNonWhitelisted)', async () => {
      const res = await request(http)
        .post('/api/__test/echo')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '', extra: true })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'name', constraint: 'isNotEmpty' }),
          expect.objectContaining({ field: 'extra', constraint: 'whitelistValidation' }),
        ]),
      );
    });
  });
});
