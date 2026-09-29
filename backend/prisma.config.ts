import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma migrate deploy` (CLI) usa uma conexão DIRETA quando disponível: o advisory
    // lock que ele toma é por sessão, e o pooler do Neon (PgBouncer em modo transaction)
    // pode rotear cada statement para uma conexão de backend diferente e travar o lock
    // (P1002). Em dev local (Postgres sem pooler) cai de volta para DATABASE_URL.
    // O app em si (PrismaService) continua usando DATABASE_URL — a pooled — em runtime.
    url: process.env.DIRECT_URL || env('DATABASE_URL'),
  },
});
