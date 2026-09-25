import { MAX_LOCKOUT_MS } from '../auth.constants.js';

export interface LockoutState {
  failedLoginAttempts: number;
  lockoutCount: number;
  lockedUntil: Date | null;
}

export interface LockoutConfig {
  maxFailedAttempts: number;
  lockoutMinutes: number;
}

export function isLocked(state: Pick<LockoutState, 'lockedUntil'>, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** Minutos restantes de bloqueio, arredondados para cima (mínimo 1). */
export function lockMinutesRemaining(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}

/**
 * Estado após uma senha errada. Ao atingir o limite, bloqueia por
 * `lockoutMinutes * 2^(bloqueios anteriores)` (teto de 24h) e zera o contador de tentativas.
 */
export function registerFailure(
  state: LockoutState,
  config: LockoutConfig,
  now: Date,
): LockoutState & { lockedNow: boolean } {
  const attempts = state.failedLoginAttempts + 1;
  if (attempts < config.maxFailedAttempts) {
    return { ...state, failedLoginAttempts: attempts, lockedNow: false };
  }
  const durationMs = Math.min(
    config.lockoutMinutes * 60_000 * 2 ** state.lockoutCount,
    MAX_LOCKOUT_MS,
  );
  return {
    failedLoginAttempts: 0,
    lockoutCount: state.lockoutCount + 1,
    lockedUntil: new Date(now.getTime() + durationMs),
    lockedNow: true,
  };
}

export const CLEARED_LOCKOUT: LockoutState = {
  failedLoginAttempts: 0,
  lockoutCount: 0,
  lockedUntil: null,
};
