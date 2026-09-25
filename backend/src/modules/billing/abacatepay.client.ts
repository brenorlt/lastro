import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { AppConfigService } from '../../config/app-config.service.js';

/** Envelope padrão de toda resposta da AbacatePay: `{ data, success, error }`. */
interface AbacatePayEnvelope<T> {
  data: T | null;
  success: boolean;
  error: string | null;
}

export interface AbacatePayProduct {
  id: string;
  externalId: string;
}

export interface AbacatePayCustomer {
  id: string;
}

export interface AbacatePayTransparentCharge {
  id: string;
  amount: number;
  status: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
}

export interface AbacatePayHostedCheckout {
  id: string;
  url: string;
}

export type AbacatePayCycle = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'ANNUALLY';

/**
 * Cliente HTTP fino para a API v2 da AbacatePay (https://docs.abacatepay.com).
 * Sem biblioteca externa — usa o `fetch` global do Node 22.
 */
@Injectable()
export class AbacatePayClient {
  private readonly logger = new Logger(AbacatePayClient.name);

  constructor(private readonly config: AppConfigService) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.config.get('ABACATEPAY_BASE_URL')}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.get('ABACATEPAY_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      this.logger.error({ path, err: error instanceof Error ? error.message : String(error) });
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, {
        message: 'Não foi possível conectar ao provedor de pagamentos',
      });
    }

    const envelope = (await response.json().catch(() => null)) as AbacatePayEnvelope<T> | null;
    if (!response.ok || !envelope?.success || envelope.data === null) {
      this.logger.error({ path, status: response.status, error: envelope?.error });
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, {
        message: envelope?.error ?? 'Provedor de pagamentos recusou a requisição',
      });
    }
    return envelope.data;
  }

  /** Idempotente: procura por `externalId` em /products/list antes de criar. */
  async ensureProduct(input: {
    externalId: string;
    name: string;
    priceCents: number;
    cycle?: AbacatePayCycle;
  }): Promise<AbacatePayProduct> {
    const existing = await this.call<AbacatePayProduct[]>('GET', '/products/list');
    const found = existing.find((p) => p.externalId === input.externalId);
    if (found) return found;
    return this.call<AbacatePayProduct>('POST', '/products/create', {
      externalId: input.externalId,
      name: input.name,
      price: input.priceCents,
      currency: 'BRL',
      cycle: input.cycle,
    });
  }

  async createCustomer(input: { email: string; name: string }): Promise<AbacatePayCustomer> {
    return this.call<AbacatePayCustomer>('POST', '/customers/create', input);
  }

  async createPixCharge(input: {
    amountCents: number;
    externalId: string;
    description: string;
  }): Promise<AbacatePayTransparentCharge> {
    return this.call<AbacatePayTransparentCharge>('POST', '/transparents/create', {
      method: 'PIX',
      data: {
        amount: input.amountCents,
        description: input.description,
        externalId: input.externalId,
      },
    });
  }

  async checkPixCharge(id: string): Promise<{ status: string }> {
    return this.call<{ id: string; status: string }>(
      'GET',
      `/transparents/check?id=${encodeURIComponent(id)}`,
    );
  }

  async createCardCheckout(input: {
    productId: string;
    customerId: string;
    externalId: string;
    returnUrl: string;
    completionUrl: string;
  }): Promise<AbacatePayHostedCheckout> {
    return this.call<AbacatePayHostedCheckout>('POST', '/checkouts/create', {
      items: [{ id: input.productId, quantity: 1 }],
      methods: ['CARD'],
      card: { maxInstallments: 1 },
      customerId: input.customerId,
      externalId: input.externalId,
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
    });
  }

  async createSubscriptionCheckout(input: {
    productId: string;
    customerId: string;
    externalId: string;
    returnUrl: string;
    completionUrl: string;
  }): Promise<AbacatePayHostedCheckout> {
    return this.call<AbacatePayHostedCheckout>('POST', '/subscriptions/create', {
      items: [{ id: input.productId, quantity: 1 }],
      methods: ['CARD'],
      card: { maxInstallments: 1 },
      customerId: input.customerId,
      externalId: input.externalId,
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
    });
  }

  async cancelSubscription(abacatepaySubscriptionId: string): Promise<void> {
    await this.call('POST', '/subscriptions/cancel', { id: abacatepaySubscriptionId });
  }
}
