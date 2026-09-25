import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service.js';

const PING_TIMEOUT_MS = 3000;

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async pingCheck(key: string) {
    const check = this.indicator.check(key);
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS);
        }),
      ]);
      return check.up({ responseTimeMs: Date.now() - started });
    } catch {
      return check.down({ message: 'Banco de dados indisponível' });
    } finally {
      clearTimeout(timer);
    }
  }
}
