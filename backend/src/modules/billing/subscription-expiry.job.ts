import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';

const JOB_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bloqueia assinaturas vencidas sem pagamento: trial expirado, ou período avulso
 * (Pix/boleto, sem renovação automática) que passou sem um novo pagamento. Também avisa
 * por e-mail quem está perto de vencer (uma vez por ciclo) e quem acabou de ser bloqueado.
 * Desligado em NODE_ENV=test; `run(now)` exposto para testes.
 */
@Injectable()
export class SubscriptionExpiryJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionExpiryJobService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly mail: MailService,
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
    const trialsBlocked = await this.blockAndNotify('TRIALING', 'trialEndsAt', now);
    const periodsBlocked = await this.blockAndNotify('ACTIVE', 'currentPeriodEnd', now);
    await this.notifyExpiringSoon(now);
    if (trialsBlocked || periodsBlocked) {
      this.logger.log({ trialsBlocked, periodsBlocked });
    }
    return { trialsBlocked, periodsBlocked };
  }

  /** Busca quem vence agora, bloqueia e dispara o aviso de "acesso venceu". */
  private async blockAndNotify(
    status: 'TRIALING' | 'ACTIVE',
    field: 'trialEndsAt' | 'currentPeriodEnd',
    now: Date,
  ): Promise<number> {
    const expired = await this.prisma.subscription.findMany({
      where: { status, [field]: { lte: now } },
      select: { id: true, user: { select: { email: true, name: true } } },
    });
    if (expired.length === 0) return 0;

    await this.prisma.subscription.updateMany({
      where: { id: { in: expired.map((s) => s.id) } },
      data: { status: 'BLOCKED' },
    });
    for (const subscription of expired) {
      await this.mail.send('SUBSCRIPTION_EXPIRED', subscription.user.email, {
        name: subscription.user.name,
      });
    }
    return expired.length;
  }

  /** Avisa quem está a poucos dias de vencer — uma vez só por ciclo (expiryNoticeSentAt). */
  private async notifyExpiringSoon(now: Date): Promise<void> {
    const noticeDays = this.config.get('BILLING_EXPIRY_NOTICE_DAYS');
    const window = new Date(now.getTime() + noticeDays * DAY_MS);

    const expiringSoon = await this.prisma.subscription.findMany({
      where: {
        expiryNoticeSentAt: null,
        OR: [
          { status: 'TRIALING', trialEndsAt: { gt: now, lte: window } },
          { status: 'ACTIVE', currentPeriodEnd: { gt: now, lte: window } },
        ],
      },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (expiringSoon.length === 0) return;

    await this.prisma.subscription.updateMany({
      where: { id: { in: expiringSoon.map((s) => s.id) } },
      data: { expiryNoticeSentAt: now },
    });
    for (const subscription of expiringSoon) {
      const endsAt =
        subscription.status === 'TRIALING'
          ? subscription.trialEndsAt
          : subscription.currentPeriodEnd!;
      const days = Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
      await this.mail.send('SUBSCRIPTION_EXPIRING_SOON', subscription.user.email, {
        name: subscription.user.name,
        days,
      });
    }
  }
}
