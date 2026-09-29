import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { Decimal } from '../../common/utils/money.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Subscription } from '../../generated/prisma/client.js';
import { AbacatePayClient } from './abacatepay.client.js';
import type { BillingStatusDto, BoletoCheckoutDto, PixCheckoutDto } from './billing.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 30;
// A AbacatePay trata `externalId` como chave de idempotência: reemitir Pix para o mesmo
// usuário enquanto a cobrança anterior está válida retorna a MESMA cobrança. Um Pix de
// validade curta evita ficar preso a uma cobrança velha por muito tempo.
const PIX_EXPIRES_IN_SECONDS = 5 * 60;

// Chave usada pela AbacatePay para assinar o corpo dos webhooks (HMAC-SHA256), documentada
// publicamente em https://docs.abacatepay.com/pages/webhooks — é a mesma para todo cliente
// AbacatePay; a defesa por conta é o `secret` que definimos na query string do webhook.
const ABACATEPAY_HMAC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

interface WebhookBillingLike {
  id: string;
  externalId?: string | null;
  amount: number;
  methods?: string[];
}

interface WebhookPayload {
  // A doc promete `id` no topo do payload pra dedupe, mas já chegou evento real sem
  // esse campo — tratamos como opcional e caímos pro id da cobrança (ver handleWebhook).
  id?: string;
  event: string;
  data: {
    checkout?: WebhookBillingLike;
    transparent?: WebhookBillingLike;
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

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
      planPrice: this.centsToAmount(this.planPriceCents).toFixed(2),
    };
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
    const charge = await this.createOneTimeCharge(userId, 'PIX');
    return {
      id: charge.id,
      brCode: charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      expiresAt: charge.expiresAt,
    };
  }

  async checkoutBoleto(userId: string, taxId: string): Promise<BoletoCheckoutDto> {
    await this.prisma.user.update({ where: { id: userId }, data: { taxId } });
    const charge = await this.createOneTimeCharge(userId, 'BOLETO');
    return {
      id: charge.id,
      // Sempre presentes quando method = "BOLETO" — garantido pela AbacatePay.
      barCode: charge.barCode!,
      url: charge.url!,
      brCode: charge.brCode,
      brCodeBase64: charge.brCodeBase64,
      expiresAt: charge.expiresAt,
    };
  }

  private async createOneTimeCharge(userId: string, method: 'PIX' | 'BOLETO') {
    await this.ensureCustomerId(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, taxId: true },
    });
    const charge = await this.abacatepay.createTransparentCharge({
      method,
      amountCents: this.planPriceCents,
      externalId: userId,
      description: 'Lastro Completo - 30 dias de acesso',
      // Exigido pela AbacatePay só para boleto; `taxId` sempre presente nesse caminho
      // (gravado em checkoutBoleto antes de chegar aqui).
      customer: method === 'BOLETO' ? { name: user.name, taxId: user.taxId! } : undefined,
      expiresInSeconds: method === 'PIX' ? PIX_EXPIRES_IN_SECONDS : undefined,
    });
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
    const paymentData = {
      userId,
      subscriptionId: subscription.id,
      method,
      status: 'PENDING' as const,
      amount: this.centsToAmount(this.planPriceCents),
      pixQrCode: charge.brCode,
      pixQrCodeImage: charge.brCodeBase64,
      barCode: charge.barCode,
      checkoutUrl: charge.url,
      expiresAt: new Date(charge.expiresAt),
    };
    // Enquanto a cobrança anterior for válida, a AbacatePay devolve o mesmo `charge.id`
    // (idempotência por externalId) — upsert evita conflito de unicidade nesse caso.
    await this.prisma.payment.upsert({
      where: { abacatepayChargeId: charge.id },
      create: { ...paymentData, abacatepayChargeId: charge.id },
      update: paymentData,
    });
    return charge;
  }

  /** Verifica os dois mecanismos de segurança documentados e roteia o evento. */
  async handleWebhook(
    rawBody: Buffer,
    secretFromQuery: string | undefined,
    signature: string | undefined,
  ) {
    // .trim() evita 401 silencioso por espaço/quebra de linha colado junto do valor
    // ao configurar ABACATEPAY_WEBHOOK_SECRET no ambiente (erro comum em painéis tipo Render).
    if (secretFromQuery !== this.config.get('ABACATEPAY_WEBHOOK_SECRET').trim()) {
      this.logger.warn('webhook rejeitado: query secret não bate com ABACATEPAY_WEBHOOK_SECRET');
      throw new AppException(ErrorCode.WEBHOOK_SIGNATURE_INVALID);
    }
    if (!signature || !this.verifySignature(rawBody, signature)) {
      this.logger.warn('webhook rejeitado: assinatura HMAC (x-webhook-signature) inválida');
      throw new AppException(ErrorCode.WEBHOOK_SIGNATURE_INVALID);
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
    const billing = payload.data.checkout ?? payload.data.transparent;
    const dedupeId = payload.id ?? (billing ? `${payload.event}:${billing.id}` : undefined);
    if (dedupeId) {
      try {
        await this.prisma.billingWebhookEvent.create({
          data: { id: dedupeId, event: payload.event },
        });
      } catch (error) {
        if (isUniqueViolation(error)) return; // já processado (retentativa)
        throw error;
      }
    } else {
      this.logger.warn({ event: payload.event }, 'webhook sem id nem cobrança — sem dedupe');
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
    const method = billing.methods?.[0] === 'BOLETO' ? 'BOLETO' : 'PIX';
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
