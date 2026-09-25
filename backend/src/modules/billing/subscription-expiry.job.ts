import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';

const JOB_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Bloqueia assinaturas vencidas sem pagamento: trial expirado, ou período avulso
 * (Pix/Cartão sem recorrência) que passou sem renovação manual, ou recorrência
 * cancelada (`cancelAtPeriodEnd`) que chegou ao fim do ciclo já pago. Assinaturas
 * recorrentes ativas em dia nunca caem aqui — só saem de ACTIVE via webhook.
 * Desligado em NODE_ENV=test; `run(now)` exposto para testes.
 */
@Injectable()
export class SubscriptionExpiryJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionExpiryJobService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;
    this.timer = setInterval(() => void this.run(), JOB_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 60_000).unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(now: Date = new Date()): Promise<{ trialsBlocked: number; periodsBlocked: number }> {
    const trials = await this.prisma.subscription.updateMany({
      where: { status: 'TRIALING', trialEndsAt: { lte: now } },
      data: { status: 'BLOCKED' },
    });
    const periods = await this.prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
        OR: [{ cancelAtPeriodEnd: true }, { abacatepaySubscriptionId: null }],
      },
      data: { status: 'BLOCKED' },
    });
    if (trials.count || periods.count) {
      this.logger.log({ trialsBlocked: trials.count, periodsBlocked: periods.count });
    }
    return { trialsBlocked: trials.count, periodsBlocked: periods.count };
  }
}
