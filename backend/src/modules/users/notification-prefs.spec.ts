import { describe, expect, it } from '@jest/globals';
import { DEFAULT_NOTIFICATION_PREFS, mergeNotificationPrefs } from './notification-prefs.js';

describe('mergeNotificationPrefs', () => {
  it('sem dados salvos devolve os padrões completos', () => {
    expect(mergeNotificationPrefs({})).toEqual({
      channels: { inApp: true, email: true },
      billsDue: true,
      invoiceDue: true,
      budgetAlerts: true,
      goalReminders: true,
      emergencyFund: true,
      newTransactions: false,
      recurring: true,
      weeklySummary: false,
    });
    expect(mergeNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it('mescla em profundidade: salvo → patch, inclusive channels parcial', () => {
    const stored = { billsDue: false, channels: { email: false } };
    const merged = mergeNotificationPrefs(stored, {
      weeklySummary: true,
      channels: { inApp: false },
    });
    expect(merged.billsDue).toBe(false);
    expect(merged.weeklySummary).toBe(true);
    expect(merged.channels).toEqual({ inApp: false, email: false });
    expect(merged.invoiceDue).toBe(true);
  });

  it('descarta chaves desconhecidas e valores não booleanos', () => {
    const merged = mergeNotificationPrefs({ billsDue: 'sim', hacker: true, channels: [1] });
    expect(merged).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(merged).not.toHaveProperty('hacker');
  });

  it('não muta os padrões', () => {
    const merged = mergeNotificationPrefs({ channels: { email: false } });
    merged.channels.inApp = false;
    expect(DEFAULT_NOTIFICATION_PREFS.channels).toEqual({ inApp: true, email: true });
  });
});
