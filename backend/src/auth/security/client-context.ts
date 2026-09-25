import type { Request } from 'express';

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

/** IP (já resolvido pelo Express conforme TRUST_PROXY) e user-agent truncados para persistência. */
export function clientContext(req: Request): ClientContext {
  const userAgent = req.headers['user-agent'];
  return {
    ip: req.ip ? req.ip.replace(/^::ffff:/, '').slice(0, 64) : null,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
  };
}
