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

  /** Cobrança avulsa via Pix ou boleto (o boleto sempre vem com Pix alternativo). */
  async createTransparentCharge(input: {
    method: 'PIX' | 'BOLETO';
    amountCents: number;
    externalId: string;
    description: string;
  }): Promise<AbacatePayTransparentCharge> {
    return this.call<AbacatePayTransparentCharge>('POST', '/transparents/create', {
      method: input.method,
      data: {
        amount: input.amountCents,
        description: input.description,
        externalId: input.externalId,
      },
    });
  }
}
