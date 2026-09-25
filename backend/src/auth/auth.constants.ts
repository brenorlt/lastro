export const JWT_ISSUER = 'lastro-api';
export const JWT_AUDIENCE = 'lastro-app';

export const REFRESH_COOKIE = 'lastro_rt';
export const SESSION_INDICATOR_COOKIE = 'lastro_session';
export const REFRESH_COOKIE_PATH = '/api/auth';

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Só regravamos session.lastUsedAt se o valor atual for mais antigo que isto. */
export const LAST_USED_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

/** Teto do bloqueio progressivo por força bruta. */
export const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000;

/** Registros expirados/revogados/usados há mais que isto são removidos pela limpeza. */
export const CLEANUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
