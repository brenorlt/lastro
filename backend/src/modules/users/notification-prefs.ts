// `type` (e não interface) para ser atribuível a Prisma.InputJsonObject.
export type NotificationChannels = {
  inApp: boolean;
  email: boolean;
};

export type NotificationPrefs = {
  channels: NotificationChannels;
  billsDue: boolean;
  invoiceDue: boolean;
  budgetAlerts: boolean;
  goalReminders: boolean;
  emergencyFund: boolean;
  newTransactions: boolean;
  recurring: boolean;
  weeklySummary: boolean;
};

export type NotificationPrefsPatch = Partial<Omit<NotificationPrefs, 'channels'>> & {
  channels?: Partial<NotificationChannels>;
};

export const DEFAULT_NOTIFICATION_PREFS: Readonly<NotificationPrefs> = Object.freeze({
  channels: Object.freeze({ inApp: true, email: true }),
  billsDue: true,
  invoiceDue: true,
  budgetAlerts: true,
  goalReminders: true,
  emergencyFund: true,
  newTransactions: false,
  recurring: true,
  weeklySummary: false,
});

const TOPIC_KEYS = [
  'billsDue',
  'invoiceDue',
  'budgetAlerts',
  'goalReminders',
  'emergencyFund',
  'newTransactions',
  'recurring',
  'weeklySummary',
] as const;
const CHANNEL_KEYS = ['inApp', 'email'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Mescla (em profundidade) preferências salvas e/ou um patch sobre os padrões.
 * Chaves desconhecidas e valores não booleanos são descartados, então o JSON salvo
 * no banco sempre volta no formato completo e tipado.
 */
export function mergeNotificationPrefs(...sources: unknown[]): NotificationPrefs {
  const result: NotificationPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    channels: { ...DEFAULT_NOTIFICATION_PREFS.channels },
  };
  for (const source of sources) {
    if (!isRecord(source)) continue;
    for (const key of TOPIC_KEYS) {
      const value = source[key];
      if (typeof value === 'boolean') result[key] = value;
    }
    const channels = source.channels;
    if (isRecord(channels)) {
      for (const key of CHANNEL_KEYS) {
        const value = channels[key];
        if (typeof value === 'boolean') result.channels[key] = value;
      }
    }
  }
  return result;
}
