/**
 * Seed idempotente e não destrutivo: garante as categorias padrão para usuários
 * que ainda não possuem nenhuma. Nunca apaga nem sobrescreve dados.
 * Uso: npm run db:seed
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DEFAULT_CATEGORIES } from '../src/modules/categories/default-categories.js';

config({ quiet: true });

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não definido');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null, categories: { none: {} } },
      select: { id: true },
    });

    for (const user of users) {
      await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map((category) => ({
          ...category,
          userId: user.id,
          isDefault: true,
        })),
      });
    }

    console.log(
      `Seed concluído: categorias padrão criadas para ${users.length} usuário(s) ` +
        `(${DEFAULT_CATEGORIES.length} categorias disponíveis).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
