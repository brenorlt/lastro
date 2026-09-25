import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { Decimal } from '../../common/utils/money.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Subscription } from '../../generated/prisma/client.js';
import { AbacatePayClient } from './abacatepay.client.js';
import type { BillingStatusDto, HostedCheckoutDto, PixCheckoutDto } from './billing.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 30;

// Chave usada pela AbacatePay para assinar o corpo dos webhooks (HMAC-SHA256), documentada
// publicamente em https://docs.abacatepay.com/pages/webhooks — é a mesma para todo cliente
// AbacatePay; a defesa por conta é o `secret` que definimos na query string do webhook.
const ABACATEPAY_HMAC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

const PRODUCT_ONE_TIME_EXTERNAL_ID = 'lastro-completo-avulso';
const PRODUCT_SUBSCRIPTION_EXTERNAL_ID = 'lastro-completo-assinatura';

interface WebhookBillingLike {
  id: string;
  externalId?: string | null;
  amount: number;
  methods?: string[];
}

interface WebhookPayload {
  id: string;
  event: string;
  data: {
    checkout?: WebhookBillingLike;
    transparent?: WebhookBillingLike;
    payment?: { id: string; externalId?: string | null; amount: number };
    subscription?: {
      id: string;
      amount: number;
      method: 'PIX' | 'CARD';
      status: string;
      cancelledDueTo?: string | null;
    };
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly productIdCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly abacatepay: AbacatePayClient,
  ) {}

  private get planPriceCents(): number {
    return this.config.get('BILLING_PLAN_PRICE_CENTS');
  }

  private centsToAmount(cents: number): Decimal {
    return new Decimal(cents).dividedBy(100);
  }

  async getStatus(userId: string): Promise<BillingStatusDto> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new AppException(ErrorCode.USER_NOT_FOUND);
    return {
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      hasRecurringSubscription:
        Boolean(subscription.abacatepaySubscriptionId) && !subscription.cancelAtPeriodEnd,
      planPrice: this.centsToAmount(this.planPriceCents).toFixed(2),
    };
  }

  private async ensureProductId(kind: 'one-time' | 'subscription'): Promise<string> {
    const externalId =
      kind === 'one-time' ? PRODUCT_ONE_TIME_EXTERNAL_ID : PRODUCT_SUBSCRIPTION_EXTERNAL_ID;
    const cached = this.productIdCache.get(externalId);
    if (cached) return cached;
    const product = await this.abacatepay.ensureProduct({
      externalId,
      name: 'Lastro Completo',
      priceCents: this.planPriceCents,
      cycle: kind === 'subscription' ? 'MONTHLY' : undefined,
    });
    this.productIdCache.set(externalId, product.id);
    return product.id;
  }

  private async ensureCustomerId(userId: string): Promise<string> {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
    if (subscription.abacatepayCustomerId) return subscription.abacatepayCustomerId;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true },
    });
    const customer = await this.abacatepay.createCustomer({ email: user.email, name: user.name });
    await this.prisma.subscription.update({
      where: { userId },
      data: { abacatepayCustomerId: customer.id },
    });
    return customer.id;
  }

  async checkoutPix(userId: string): Promise<PixCheckoutDto> {
    await this.ensureCustomerId(userId);
    const charge = await this.abacatepay.createPixCharge({
      amountCents: this.planPriceCents,
      externalId: userId,
      description: 'Lastro Completo — 30 dias de acesso',
    });
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
    await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        method: 'PIX',
        status: 'PENDING',
        amount: this.centsToAmount(this.planPriceCents),
        abacatepayChargeId: charge.id,
        pixQrCode: charge.brCode,
        pixQrCodeImage: charge.brCodeBase64,
        expiresAt: new Date(charge.expiresAt),
      },
    });
    return {
      id: charge.id,
      brCode: charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      expiresAt: charge.expiresAt,
    };
  }

  async checkoutCard(userId: string): Promise<HostedCheckoutDto> {
    const [customerId, productId] = await Promise.all([
      this.ensureCustomerId(userId),
      this.ensureProductId('one-time'),
    ]);
    const appUrl = this.config.get('APP_URL');
    const checkout = await this.abacatepay.createCardCheckout({
      productId,
      customerId,
      externalId: userId,
      returnUrl: `${appUrl}/assinatura`,
      completionUrl: `${appUrl}/assinatura?pago=1`,
    });
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
    await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        method: 'CARD',
        status: 'PENDING',
        amount: this.centsToAmount(this.planPriceCents),
        abacatepayChargeId: checkout.id,
        checkoutUrl: checkout.url,
      },
    });
    return { url: checkout.url };
  }

  async checkoutSubscription(userId: string): Promise<HostedCheckoutDto> {
    const [customerId, productId] = await Promise.all([
      this.ensureCustomerId(userId),
      this.ensureProductId('subscription'),
    ]);
    const appUrl = this.config.get('APP_URL');
    const checkout = await this.abacatepay.createSubscriptionCheckout({
      productId,
      customerId,
      externalId: userId,
      returnUrl: `${appUrl}/assinatura`,
      completionUrl: `${appUrl}/assinatura?pago=1`,
    });
    return { url: checkout.url };
  }

  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
    if (!subscription.abacatepaySubscriptionId || subscription.cancelAtPeriodEnd) return;
    await this.abacatepay.cancelSubscription(subscription.abacatepaySubscriptionId);
    // Mantém acesso ACTIVE até currentPeriodEnd (sem multa/carência) — o job de expiração
    // bloqueia sozinho quando o ciclo já pago terminar.
    await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  /** Verifica os dois mecanismos de segurança documentados e roteia o evento. */
  async handleWebhook(
    rawBody: Buffer,
    secretFromQuery: string | undefined,
    signature: string | undefined,
  ) {
    if (secretFromQuery !== this.config.get('ABACATEPAY_WEBHOOK_SECRET')) {
      throw new AppException(ErrorCode.WEBHOOK_SIGNATURE_INVALID);
    }
    if (!signature || !this.verifySignature(rawBody, signature)) {
      throw new AppException(ErrorCode.WEBHOOK_SIGNATURE_INVALID);
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
    try {
      await this.prisma.billingWebhookEvent.create({
        data: { id: payload.id, event: payload.event },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return; // já processado (retentativa)
      throw error;
    }

    try {
      await this.routeEvent(payload);
    } catch (error) {
      this.logger.error({
        event: payload.event,
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private verifySignature(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac('sha256', ABACATEPAY_HMAC_KEY).update(rawBody).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async routeEvent(payload: WebhookPayload): Promise<void> {
    switch (payload.event) {
      case 'checkout.completed':
      case 'transparent.completed':
        return this.onOneTimePaid(payload);
      case 'subscription.completed':
      case 'subscription.renewed':
        return this.onSubscriptionPaid(payload);
      case 'subscription.cancelled':
        return this.onSubscriptionCancelled(payload);
      default:
        return;
    }
  }

  private async onOneTimePaid(payload: WebhookPayload): Promise<void> {
    const billing = payload.data.checkout ?? payload.data.transparent;
    if (!billing) return;
    const userId = billing.externalId;
    if (!userId) {
      this.logger.warn({ event: payload.event, billingId: billing.id }, 'sem externalId');
      return;
    }
    const method = billing.methods?.[0] === 'PIX' ? 'PIX' : 'CARD';
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({ where: { userId } });
      if (!subscription) return;

      await tx.payment.upsert({
        where: { abacatepayChargeId: billing.id },
        update: { status: 'PAID', paidAt: now },
        create: {
          userId,
          subscriptionId: subscription.id,
          method,
          status: 'PAID',
          amount: this.centsToAmount(billing.amount),
          abacatepayChargeId: billing.id,
          paidAt: now,
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: nextPeriodEnd(subscription, now),
        },
      });
    });
  }

  private async onSubscriptionPaid(payload: WebhookPayload): Promise<void> {
    const sub = payload.data.subscription;
    if (!sub) return;
    const userId = payload.data.checkout?.externalId ?? payload.data.payment?.externalId;
    if (!userId) {
      this.logger.warn({ event: payload.event, subscriptionId: sub.id }, 'sem externalId');
      return;
    }
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({ where: { userId } });
      if (!subscription) return;

      const payment = payload.data.payment;
      if (payment) {
        await tx.payment.upsert({
          where: { abacatepayChargeId: payment.id },
          update: { status: 'PAID', paidAt: now },
          create: {
            userId,
            subscriptionId: subscription.id,
            method: sub.method,
            status: 'PAID',
            amount: this.centsToAmount(payment.amount),
            abacatepayChargeId: payment.id,
            paidAt: now,
          },
        });
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          abacatepaySubscriptionId: sub.id,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: nextPeriodEnd(subscription, now),
        },
      });
    });
  }

  private async onSubscriptionCancelled(payload: WebhookPayload): Promise<void> {
    const sub = payload.data.subscription;
    // Cancelamento manual (via /billing/cancel-subscription) já foi tratado de forma síncrona;
    // só o cancelamento automático (esgotou tentativas de cobrança) precisa bloquear aqui.
    if (!sub || sub.cancelledDueTo !== 'max_payment_retries_exceeded') return;
    await this.prisma.subscription.updateMany({
      where: { abacatepaySubscriptionId: sub.id },
      data: { status: 'BLOCKED', currentPeriodEnd: new Date() },
    });
  }
}

function nextPeriodEnd(subscription: Pick<Subscription, 'currentPeriodEnd'>, now: Date): Date {
  const base =
    subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() > now.getTime()
      ? subscription.currentPeriodEnd
      : now;
  return new Date(base.getTime() + CYCLE_DAYS * DAY_MS);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
