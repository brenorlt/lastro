import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AppConfigService } from '../src/config/app-config.service.js';
import { SubscriptionExpiryJobService } from '../src/modules/billing/subscription-expiry.job.js';
import { type ErrorBody, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface BillingStatusBody {
  data: {
    status: 'TRIALING' | 'ACTIVE' | 'BLOCKED' | 'CANCELLED';
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasRecurringSubscription: boolean;
  };
}

// Chave pública da AbacatePay para o HMAC dos webhooks (mesma do billing.service).
const ABACATEPAY_HMAC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

const DAY_MS = 24 * 60 * 60 * 1000;

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

  function sendWebhook(event: string, data: Record<string, unknown>) {
    const body = JSON.stringify({ id: `log_${randomUUID()}`, event, apiVersion: 2, data });
    const signature = createHmac('sha256', ABACATEPAY_HMAC_KEY).update(body).digest('base64');
    const secret = ctx.app.get(AppConfigService).get('ABACATEPAY_WEBHOOK_SECRET').trim();
    return request(ctx.http)
      .post(`/api/billing/webhook?webhookSecret=${encodeURIComponent(secret)}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(body)
      .expect(200);
  }

  function subscriptionEvent(input: {
    subsId: string;
    chargeId: string;
    customerId: string;
    externalId: string | null;
    cancelledDueTo?: string;
  }) {
    return {
      subscription: {
        id: input.subsId,
        amount: 2500,
        method: 'CARD',
        status: input.cancelledDueTo ? 'CANCELLED' : 'ACTIVE',
        cancelledDueTo: input.cancelledDueTo ?? null,
      },
      customer: { id: input.customerId },
      payment: { id: input.chargeId, externalId: null, amount: 2500, methods: ['CARD'] },
      checkout: {
        id: `bill_${randomUUID()}`,
        externalId: input.externalId,
        amount: 2500,
        frequency: 'SUBSCRIPTION',
        methods: ['CARD'],
        customerId: input.customerId,
      },
    };
  }

  it('recorrência no cartão: ativa, renova, sobrevive ao job e bloqueia ao esgotar retentativas', async () => {
    const s = await registerAndLogin(ctx, 'billing-subs');
    const customerId = `cust_${randomUUID()}`;
    const subsId = `subs_${randomUUID()}`;
    await ctx.prisma.subscription.update({
      where: { userId: s.userId },
      data: { abacatepayCustomerId: customerId },
    });

    await sendWebhook(
      'subscription.completed',
      subscriptionEvent({
        subsId,
        chargeId: `char_${randomUUID()}`,
        customerId,
        externalId: s.userId,
      }),
    );
    let status = (await s.client.get('/api/billing/status').expect(200)).body as BillingStatusBody;
    expect(status.data.status).toBe('ACTIVE');
    expect(status.data.hasRecurringSubscription).toBe(true);
    const firstPeriodEnd = new Date(status.data.currentPeriodEnd!).getTime();

    // checkout.completed do checkout de assinatura não pode somar mais 30 dias.
    await sendWebhook('checkout.completed', {
      checkout: {
        id: `bill_${randomUUID()}`,
        externalId: s.userId,
        amount: 2500,
        methods: ['CARD'],
        frequency: 'SUBSCRIPTION',
      },
    });
    status = (await s.client.get('/api/billing/status').expect(200)).body as BillingStatusBody;
    expect(new Date(status.data.currentPeriodEnd!).getTime()).toBe(firstPeriodEnd);

    // Renovação sem externalId: acha o assinante pelo id da assinatura.
    await sendWebhook(
      'subscription.renewed',
      subscriptionEvent({ subsId, chargeId: `char_${randomUUID()}`, customerId, externalId: null }),
    );
    status = (await s.client.get('/api/billing/status').expect(200)).body as BillingStatusBody;
    expect(new Date(status.data.currentPeriodEnd!).getTime()).toBeGreaterThan(firstPeriodEnd);
    expect(await ctx.prisma.payment.count({ where: { userId: s.userId, method: 'CARD' } })).toBe(2);

    // Ciclo "venceu" há 1 dia (renovação atrasada): recorrência ativa não é bloqueada...
    await ctx.prisma.subscription.update({
      where: { userId: s.userId },
      data: { currentPeriodEnd: new Date(Date.now() - DAY_MS) },
    });
    await ctx.app.get(SubscriptionExpiryJobService).run();
    status = (await s.client.get('/api/billing/status').expect(200)).body as BillingStatusBody;
    expect(status.data.status).toBe('ACTIVE');

    // ...até a AbacatePay desistir da cobrança.
    await sendWebhook(
      'subscription.cancelled',
      subscriptionEvent({
        subsId,
        chargeId: `char_${randomUUID()}`,
        customerId,
        externalId: null,
        cancelledDueTo: 'max_payment_retries_exceeded',
      }),
    );
    status = (await s.client.get('/api/billing/status').expect(200)).body as BillingStatusBody;
    expect(status.data.status).toBe('BLOCKED');
    expect(status.data.hasRecurringSubscription).toBe(false);
  });

  it('recorrência cancelada pelo usuário mantém acesso só até o fim do ciclo pago', async () => {
    const s = await registerAndLogin(ctx, 'billing-subs-cancel');
    await ctx.prisma.subscription.update({
      where: { userId: s.userId },
      data: {
        status: 'ACTIVE',
        abacatepaySubscriptionId: `subs_${randomUUID()}`,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() - 1000),
      },
    });
    await ctx.app.get(SubscriptionExpiryJobService).run();
    const status = (await s.client.get('/api/billing/status').expect(200))
      .body as BillingStatusBody;
    expect(status.data.status).toBe('BLOCKED');
  });

  it('cartão avulso pago via checkout.completed libera 30 dias', async () => {
    const s = await registerAndLogin(ctx, 'billing-card');
    await sendWebhook('checkout.completed', {
      checkout: {
        id: `bill_${randomUUID()}`,
        externalId: s.userId,
        amount: 2500,
        methods: ['CARD'],
        frequency: 'ONE_TIME',
      },
    });
    const status = (await s.client.get('/api/billing/status').expect(200))
      .body as BillingStatusBody;
    expect(status.data.status).toBe('ACTIVE');
    expect(status.data.hasRecurringSubscription).toBe(false);
    const payment = await ctx.prisma.payment.findFirstOrThrow({ where: { userId: s.userId } });
    expect(payment.method).toBe('CARD');
  });
});
