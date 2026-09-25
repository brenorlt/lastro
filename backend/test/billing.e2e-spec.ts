import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { SubscriptionExpiryJobService } from '../src/modules/billing/subscription-expiry.job.js';
import { type ErrorBody, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface BillingStatusBody {
  data: {
    status: 'TRIALING' | 'ACTIVE' | 'BLOCKED' | 'CANCELLED';
    trialEndsAt: string | null;
  };
}

describe('Billing (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('cadastro cria a assinatura em trial, e o bloqueio por trial vencido corta o acesso', async () => {
    const s = await registerAndLogin(ctx, 'billing');

    const status = (await s.client.get('/api/billing/status').expect(200))
      .body as BillingStatusBody;
    expect(status.data.status).toBe('TRIALING');
    expect(status.data.trialEndsAt).not.toBeNull();

    // Ainda dentro do trial: rota comum liberada.
    await s.client.get('/api/accounts').expect(200);

    // Força o trial pro passado e roda o job de expiração (mesma lógica do cron horário).
    await ctx.prisma.subscription.update({
      where: { userId: s.userId },
      data: { trialEndsAt: new Date(Date.now() - 1000) },
    });
    await ctx.app.get(SubscriptionExpiryJobService).run();

    const blockedStatus = (await s.client.get('/api/billing/status').expect(200))
      .body as BillingStatusBody;
    expect(blockedStatus.data.status).toBe('BLOCKED');

    // Rota comum agora bloqueada com 402 SUBSCRIPTION_REQUIRED...
    const blocked = (await s.client.get('/api/accounts').expect(402)).body as ErrorBody;
    expect(blocked.code).toBe('SUBSCRIPTION_REQUIRED');

    // ...mas cobrança e conta continuam acessíveis.
    await s.client.get('/api/billing/status').expect(200);
    await s.client.get('/api/auth/me').expect(200);
  });
});
