import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Notification, Prisma } from '../../generated/prisma/client.js';
import type { NotificationType } from '../../generated/prisma/enums.js';
import { MailService } from '../mail/mail.service.js';
import { mergeNotificationPrefs, type NotificationPrefs } from '../users/notification-prefs.js';

export type TopicKey = Exclude<keyof NotificationPrefs, 'channels'>;

/** Tipos que também vão por e-mail (se o canal estiver ligado) — mantém o volume baixo. */
export const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  'BILL_DUE',
  'INVOICE_DUE',
  'WEEKLY_SUMMARY',
]);

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  /** Deve incluir `href` para o frontend. */
  data: Prisma.InputJsonObject;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Prisma.JsonValue;
  readAt: string | null;
  createdAt: string;
}

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Preferências efetivas: tópico ligado E canal in-app ligado. */
  async isEnabled(userId: string, topic: TopicKey): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    if (!user) return false;
    const prefs = mergeNotificationPrefs(user.notificationPrefs);
    return prefs.channels.inApp && prefs[topic];
  }

  create(userId: string, input: NotificationInput & { dedupeKey?: string }) {
    return this.prisma.notification.create({ data: { userId, ...input } });
  }

  /**
   * Notifica respeitando preferências (tópico + canais) e idempotência (dedupeKey único por
   * usuário). Com in-app desligado e e-mail ligado, o registro é gravado já como lido (serve de
   * histórico e de trava de duplicidade). Retorna true se criou.
   */
  async notify(
    userId: string,
    input: NotificationInput,
    options: {
      topic?: TopicKey;
      dedupeKey?: string;
      prefs?: NotificationPrefs;
      email?: string;
      name?: string;
    } = {},
  ): Promise<boolean> {
    let prefs = options.prefs;
    let email = options.email;
    let name = options.name;
    if (!prefs || !email) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPrefs: true, email: true, name: true, deletedAt: true },
      });
      if (!user || user.deletedAt) return false;
      prefs = mergeNotificationPrefs(user.notificationPrefs);
      email = user.email;
      name = user.name;
    }
    if (options.topic && !prefs[options.topic]) return false;
    const inApp = prefs.channels.inApp;
    const byEmail = prefs.channels.email && EMAIL_TYPES.has(input.type);
    if (!inApp && !byEmail) return false;

    const { count } = await this.prisma.notification.createMany({
      data: [
        {
          userId,
          ...input,
          dedupeKey: options.dedupeKey ?? null,
          readAt: inApp ? null : new Date(),
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) return false;
    if (byEmail) {
      const href = typeof input.data.href === 'string' ? input.data.href : '';
      await this.mail.send('NOTIFICATION', email, {
        name,
        title: input.title,
        text: input.body,
        link: href ? `${this.mail.appUrl}${href}` : undefined,
      });
    }
    return true;
  }

  async list(
    userId: string,
    query: { unread?: boolean; type?: NotificationType; page?: number; pageSize?: number },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unread ? { readAt: null } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      data: rows.map(toNotificationDto),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), unreadCount },
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const found = await this.findOwned(userId, id);
    const updated = found.readAt
      ? found
      : await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return toNotificationDto(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.notification.delete({ where: { id } });
  }

  async removeRead(userId: string): Promise<{ deleted: number }> {
    const { count } = await this.prisma.notification.deleteMany({
      where: { userId, readAt: { not: null } },
    });
    return { deleted: count };
  }

  private async findOwned(userId: string, id: string) {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new AppException(ErrorCode.NOTIFICATION_NOT_FOUND);
    return found;
  }
}
