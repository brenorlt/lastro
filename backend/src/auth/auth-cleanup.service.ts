import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { CLEANUP_INTERVAL_MS, CLEANUP_RETENTION_MS } from './auth.constants.js';

/**
 * Remove sessões e tokens de verificação expirados/revogados/usados há mais de 7 dias.
 * Roda a cada hora no processo (desligado em NODE_ENV=test). Com várias réplicas, a
 * operação é idempotente; mover para um job dedicado quando houver fila/cron.
 */
@Injectable()
export class AuthCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.isTest) return;
    this.timer = setInterval(() => void this.run(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<{ sessions: number; tokens: number }> {
    const cutoff = new Date(now.getTime() - CLEANUP_RETENTION_MS);
    try {
      const sessions = await this.prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
      });
      const tokens = await this.prisma.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
      });
      // Apps conectados (MCP): códigos e tokens vencidos. Refresh usado fica até vencer (detecção de reuso).
      await this.prisma.appAuthorizationCode.deleteMany({ where: { expiresAt: { lt: cutoff } } });
      await this.prisma.appToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
      if (sessions.count || tokens.count) {
        this.logger.log({ sessions: sessions.count, tokens: tokens.count }, 'Limpeza de auth');
      }
      return { sessions: sessions.count, tokens: tokens.count };
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Falha na limpeza',
      );
      return { sessions: 0, tokens: 0 };
    }
  }
}
