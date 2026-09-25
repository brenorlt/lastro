import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { SecurityEventType } from '../../generated/prisma/enums.js';
import type { ClientContext } from './client-context.js';

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: string | null;
  email?: string | null;
  context?: ClientContext;
  /** Nunca inclua senhas, tokens ou hashes aqui. */
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Registra um evento de auditoria. Falhas não interrompem o fluxo de autenticação. */
  async record(input: SecurityEventInput): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          type: input.type,
          userId: input.userId ?? null,
          email: input.email ?? null,
          ip: input.context?.ip ?? null,
          userAgent: input.context?.userAgent ?? null,
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      this.logger.error(
        { type: input.type, err: error instanceof Error ? error.message : String(error) },
        'Falha ao registrar evento de segurança',
      );
    }
  }
}
