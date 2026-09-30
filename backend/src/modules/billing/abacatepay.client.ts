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

/** Checkout hospedado (cartão avulso ou checkout de assinatura) — `bill_...`. */
export interface AbacatePayHostedCheckout {
  id: string;
  url: string;
}

export type AbacatePayCycle = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'ANNUALLY';

export interface AbacatePayCustomer {
  id: string;
}

export interface AbacatePayTransparentCharge {
  id: string;
  amount: number;
  status: string;
  // Pix e Pix alternativo (também presente em cobranças de boleto).
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
  // Só presentes quando method = "BOLETO".
  barCode?: string;
  url?: string;
}

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

  async createCustomer(input: { email: string; name: string }): Promise<AbacatePayCustomer> {
    return this.call<AbacatePayCustomer>('POST', '/customers/create', input);
  }

  /**
   * Cobrança avulsa via Pix ou boleto (o boleto sempre vem com Pix alternativo).
   * A AbacatePay exige `data.customer` (nome + CPF/CNPJ) para boleto — para Pix é ignorado.
   * `expiresInSeconds` só se aplica a Pix (ignorado pela AbacatePay para boleto).
   */
  async createTransparentCharge(input: {
    method: 'PIX' | 'BOLETO';
    amountCents: number;
    externalId: string;
    description: string;
    customer?: { name: string; taxId: string };
    expiresInSeconds?: number;
  }): Promise<AbacatePayTransparentCharge> {
    return this.call<AbacatePayTransparentCharge>('POST', '/transparents/create', {
      method: input.method,
      data: {
        amount: input.amountCents,
        description: input.description,
        externalId: input.externalId,
        ...(input.customer ? { customer: input.customer } : {}),
        ...(input.expiresInSeconds ? { expiresIn: input.expiresInSeconds } : {}),
      },
    });
  }

  /** Idempotente: procura o produto por `externalId` antes de criar. */
  async ensureProduct(input: {
    externalId: string;
    name: string;
    priceCents: number;
    cycle?: AbacatePayCycle;
  }): Promise<AbacatePayProduct> {
    const existing = await this.call<AbacatePayProduct[]>(
      'GET',
      `/products/list?externalId=${encodeURIComponent(input.externalId)}`,
    );
    const found = existing.find((p) => p.externalId === input.externalId);
    if (found) return found;
    return this.call<AbacatePayProduct>('POST', '/products/create', {
      externalId: input.externalId,
      name: input.name,
      price: input.priceCents,
      currency: 'BRL',
      ...(input.cycle ? { cycle: input.cycle } : {}),
    });
  }

  /** Checkout hospedado de pagamento único no cartão (à vista). */
  async createCardCheckout(input: HostedCheckoutInput): Promise<AbacatePayHostedCheckout> {
    return this.call<AbacatePayHostedCheckout>('POST', '/checkouts/create', {
      ...hostedCheckoutBody(input),
      card: { maxInstallments: 1 },
    });
  }

  /**
   * Checkout de assinatura no cartão. A assinatura em si (`subs_...`) só passa a existir
   * depois do pagamento — chega pelo webhook `subscription.completed`.
   */
  async createSubscriptionCheckout(input: HostedCheckoutInput): Promise<AbacatePayHostedCheckout> {
    return this.call<AbacatePayHostedCheckout>('POST', '/subscriptions/create', {
      ...hostedCheckoutBody(input),
      card: { maxInstallments: 1 },
    });
  }

  /** Cancela na hora do lado da AbacatePay (sem cobranças futuras). */
  async cancelSubscription(abacatepaySubscriptionId: string): Promise<void> {
    await this.call('POST', '/subscriptions/cancel', { id: abacatepaySubscriptionId });
  }
}

interface HostedCheckoutInput {
  productId: string;
  customerId: string;
  externalId: string;
  returnUrl: string;
  completionUrl: string;
}

function hostedCheckoutBody(input: HostedCheckoutInput) {
  return {
    items: [{ id: input.productId, quantity: 1 }],
    methods: ['CARD'],
    customerId: input.customerId,
    externalId: input.externalId,
    returnUrl: input.returnUrl,
    completionUrl: input.completionUrl,
  };
}
