import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
// Formato aceito por `jsonwebtoken`/`ms`: número de segundos ou "15m", "30d", "12h"...
const DURATION_REGEX = /^\d+(ms|s|m|h|d|w|y)?$/;

const secret = (name: string) =>
  z
    .string({ error: `${name} é obrigatório` })
    .min(32, { error: `${name} deve ter pelo menos 32 caracteres` });

const duration = (fallback: string) =>
  z
    .string()
    .regex(DURATION_REGEX, { error: 'duração inválida (ex.: 900, 15m, 30d)' })
    .default(fallback);

const csvUrls = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url({ error: 'CORS_ORIGINS deve conter apenas URLs válidas' })));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    APP_URL: z.url().default('http://localhost:3333'),

    DATABASE_URL: z
      .string({ error: 'DATABASE_URL é obrigatório' })
      .regex(/^postgres(ql)?:\/\//, { error: 'DATABASE_URL deve ser uma URL postgresql://' }),

    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL: duration('15m'),
    JWT_REFRESH_TTL: duration('30d'),

    CORS_ORIGINS: csvUrls,

    THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    SWAGGER_ENABLED: z.stringbool().default(false),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    BODY_LIMIT: z
      .string()
      .regex(/^\d+(b|kb|mb)$/i, { error: 'BODY_LIMIT inválido (ex.: 1mb)' })
      .default('1mb'),

    ARGON2_MEMORY_COST: z.coerce.number().int().min(8192).default(19_456),
    ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(1).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
    // Exigir e-mail confirmado para entrar. Padrão seguro = true; desligado temporariamente no .env.
    AUTH_REQUIRE_EMAIL_VERIFICATION: z.stringbool().default(true),

    // Domínio do cookie de sessão (vazio = host atual, recomendado com o proxy do Next).
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),

    // Diretório de arquivos enviados (avatares). Em Docker, monte um volume aqui.
    UPLOAD_DIR: z.string().min(1).default('./storage'),

    MAIL_TRANSPORT: z.enum(['log', 'smtp', 'resend']).default('log'),
    MAIL_FROM: z.string().min(3).default('Lastro <nao-responda@lastrofinance.com>'),
    SMTP_URL: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    // Obrigatório com MAIL_TRANSPORT=resend — gere em resend.com/api-keys.
    RESEND_API_KEY: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    // Dias de antecedência do aviso de "acesso prestes a vencer" (trial ou período pago).
    BILLING_EXPIRY_NOTICE_DAYS: z.coerce.number().int().min(1).default(3),

    // Cobrança (AbacatePay): chave de API da loja e segredo do webhook (ambos obrigatórios,
    // sem default — usar um placeholder óbvio no .env até a conta real existir).
    ABACATEPAY_API_KEY: z.string({ error: 'ABACATEPAY_API_KEY é obrigatório' }).min(1),
    ABACATEPAY_BASE_URL: z.url().default('https://api.abacatepay.com/v2'),
    ABACATEPAY_WEBHOOK_SECRET: secret('ABACATEPAY_WEBHOOK_SECRET'),
    BILLING_TRIAL_DAYS: z.coerce.number().int().min(1).default(7),
    BILLING_PLAN_PRICE_CENTS: z.coerce.number().int().min(1).default(2500),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    error: 'JWT_REFRESH_SECRET deve ser diferente de JWT_ACCESS_SECRET',
  })
  .refine((env) => env.MAIL_TRANSPORT !== 'smtp' || Boolean(env.SMTP_URL), {
    path: ['SMTP_URL'],
    error: 'SMTP_URL é obrigatório quando MAIL_TRANSPORT=smtp',
  })
  .refine((env) => env.MAIL_TRANSPORT !== 'resend' || Boolean(env.RESEND_API_KEY), {
    path: ['RESEND_API_KEY'],
    error: 'RESEND_API_KEY é obrigatório quando MAIL_TRANSPORT=resend',
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valida as variáveis de ambiente e falha rápido com uma mensagem legível.
 * Só nomes de variáveis e regras violadas são exibidos — nunca os valores.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const key = issue.path.join('.') || '(raiz)';
    return `  - ${key}: ${issue.message}`;
  });
  throw new Error(`Configuração de ambiente inválida:\n${lines.join('\n')}`);
}
