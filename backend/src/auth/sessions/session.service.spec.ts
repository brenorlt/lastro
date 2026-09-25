import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/errors/app.exception.js';
import type { AppConfigService } from '../../config/app-config.service.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { Session } from '../../generated/prisma/client.js';
import type { SecurityEventsService } from '../security/security-events.service.js';
import { parseRefreshToken, sha256 } from '../tokens/token.util.js';
import { SessionService } from './session.service.js';

type Where = Record<string, unknown>;

function matches(row: Session, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key as keyof Session];
    if (condition === null) return value === null;
    if (typeof condition === 'object' && condition !== null && !(condition instanceof Date)) {
      const c = condition as { not?: unknown; gt?: Date };
      if ('not' in c) return value !== c.not;
      if (c.gt) return value instanceof Date && value > c.gt;
    }
    return value === condition;
  });
}

/** Prisma em memória com o subconjunto de `session` usado pelo SessionService. */
class FakePrisma {
  rows: Session[] = [];
  beforeTransaction?: () => void;

  session = {
    findUnique: ({ where }: { where: { id: string } }) => {
      const row = this.rows.find((r) => r.id === where.id);
      return Promise.resolve(row ? { ...row, user: { deletedAt: null } } : null);
    },
    create: ({ data }: { data: Partial<Session> }) => {
      const now = new Date();
      const row = {
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
        replacedById: null,
        lastUsedAt: null,
        ...data,
      } as Session;
      this.rows.push(row);
      return Promise.resolve({ ...row });
    },
    updateMany: ({ where, data }: { where: Where; data: Partial<Session> }) => {
      const matched = this.rows.filter((r) => matches(r, where));
      matched.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: matched.length });
    },
  };

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    this.beforeTransaction?.();
    const snapshot = this.rows.map((r) => ({ ...r }));
    try {
      return await fn(this);
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }

  byId(id: string): Session {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error(`sessão ${id} não existe`);
    return row;
  }
}

const context = { ip: '203.0.113.7', userAgent: 'jest' };
const USER_ID = '0b5e7c9a-1d2e-4f3a-8b4c-5d6e7f8a9b0c';

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => expect(error.code).toBe(code));
}

describe('SessionService', () => {
  let db: FakePrisma;
  let events: { record: jest.Mock<SecurityEventsService['record']> };
  let service: SessionService;

  beforeEach(() => {
    db = new FakePrisma();
    events = { record: jest.fn<SecurityEventsService['record']>(() => Promise.resolve()) };
    const config = { get: (key: string) => (key === 'JWT_REFRESH_TTL' ? '30d' : undefined) };
    service = new SessionService(
      db as unknown as PrismaService,
      events as unknown as SecurityEventsService,
      config as unknown as AppConfigService,
    );
  });

  it('cria sessão guardando só o hash do segredo, com vida absoluta = JWT_REFRESH_TTL', async () => {
    const { session, refreshToken } = await service.create(USER_ID, context);
    const parsed = parseRefreshToken(refreshToken);

    expect(parsed?.sessionId).toBe(session.id);
    expect(session.refreshTokenHash).toBe(sha256(parsed?.secret ?? ''));
    expect(session.refreshTokenHash).not.toContain(parsed?.secret ?? '-');
    const lifetime = session.expiresAt.getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(29.9 * 86_400_000);
    expect(lifetime).toBeLessThanOrEqual(30 * 86_400_000);
  });

  it('rotaciona: nova sessão na mesma família, antiga revogada com replacedById', async () => {
    const first = await service.create(USER_ID, context);
    const second = await service.rotate(first.refreshToken, context);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.session.familyId).toBe(first.session.familyId);
    // A família não é estendida pela rotação.
    expect(second.session.expiresAt.getTime()).toBe(first.session.expiresAt.getTime());

    const old = db.byId(first.session.id);
    expect(old.revokedAt).toBeInstanceOf(Date);
    expect(old.replacedById).toBe(second.session.id);
    expect(db.byId(second.session.id).revokedAt).toBeNull();
  });

  it('reuso de token rotacionado revoga toda a família e registra o evento', async () => {
    const first = await service.create(USER_ID, context);
    const second = await service.rotate(first.refreshToken, context);
    const third = await service.rotate(second.refreshToken, context);
    const otherFamily = await service.create(USER_ID, context);

    await expectCode(service.rotate(first.refreshToken, context), 'SESSION_REVOKED');

    expect(db.byId(third.session.id).revokedAt).toBeInstanceOf(Date);
    expect(db.byId(otherFamily.session.id).revokedAt).toBeNull();
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REFRESH_REUSE_DETECTED', userId: USER_ID }),
    );
    // O token mais novo da família também deixa de funcionar.
    await expectCode(service.rotate(third.refreshToken, context), 'SESSION_REVOKED');
  });

  it('segredo errado para um id existente → UNAUTHORIZED sem revogar a família', async () => {
    const first = await service.create(USER_ID, context);
    const forged = `${first.session.id}.${'x'.repeat(43)}`;

    await expectCode(service.rotate(forged, context), 'UNAUTHORIZED');
    expect(db.byId(first.session.id).revokedAt).toBeNull();
    expect(events.record).not.toHaveBeenCalled();
  });

  it('token ausente/malformado → UNAUTHORIZED; família expirada → SESSION_EXPIRED', async () => {
    await expectCode(service.rotate(undefined, context), 'UNAUTHORIZED');
    await expectCode(service.rotate('lixo', context), 'UNAUTHORIZED');

    const first = await service.create(USER_ID, context);
    db.byId(first.session.id).expiresAt = new Date(Date.now() - 1000);
    await expectCode(service.rotate(first.refreshToken, context), 'SESSION_EXPIRED');
  });

  it('rotação concorrente (outra requisição venceu) é tratada como reuso', async () => {
    const first = await service.create(USER_ID, context);
    db.beforeTransaction = () => {
      db.byId(first.session.id).revokedAt = new Date();
    };

    await expectCode(service.rotate(first.refreshToken, context), 'SESSION_REVOKED');
    // A sessão criada dentro da transação foi desfeita.
    expect(db.rows).toHaveLength(1);
  });
});
