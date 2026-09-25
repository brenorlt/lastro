import { describe, expect, it } from '@jest/globals';
import {
  CLEARED_LOCKOUT,
  isLocked,
  lockMinutesRemaining,
  registerFailure,
  type LockoutState,
} from './lockout.policy.js';

const config = { maxFailedAttempts: 5, lockoutMinutes: 15 };
const now = new Date('2026-01-01T12:00:00Z');
const MINUTE = 60_000;

describe('lockout policy', () => {
  it('incrementa tentativas sem bloquear antes do limite', () => {
    let state: LockoutState = { ...CLEARED_LOCKOUT };
    for (let i = 1; i < 5; i++) {
      const next = registerFailure(state, config, now);
      expect(next.lockedNow).toBe(false);
      expect(next.failedLoginAttempts).toBe(i);
      expect(next.lockedUntil).toBeNull();
      state = next;
    }
  });

  it('bloqueia na N-ésima falha e zera o contador', () => {
    const next = registerFailure({ ...CLEARED_LOCKOUT, failedLoginAttempts: 4 }, config, now);
    expect(next.lockedNow).toBe(true);
    expect(next.failedLoginAttempts).toBe(0);
    expect(next.lockoutCount).toBe(1);
    expect(next.lockedUntil?.getTime()).toBe(now.getTime() + 15 * MINUTE);
    expect(isLocked(next, now)).toBe(true);
    expect(isLocked(next, new Date(now.getTime() + 15 * MINUTE))).toBe(false);
  });

  it('dobra a duração a cada novo bloqueio, com teto de 24h', () => {
    const second = registerFailure(
      { failedLoginAttempts: 4, lockoutCount: 1, lockedUntil: null },
      config,
      now,
    );
    expect(second.lockedUntil?.getTime()).toBe(now.getTime() + 30 * MINUTE);

    const huge = registerFailure(
      { failedLoginAttempts: 4, lockoutCount: 20, lockedUntil: null },
      config,
      now,
    );
    expect(huge.lockedUntil?.getTime()).toBe(now.getTime() + 24 * 60 * MINUTE);
  });

  it('calcula minutos restantes arredondando para cima', () => {
    expect(lockMinutesRemaining(new Date(now.getTime() + 61_000), now)).toBe(2);
    expect(lockMinutesRemaining(new Date(now.getTime() + 1_000), now)).toBe(1);
  });
});
