import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TagDto, UpdateTagDto } from './tag.dto.js';

const PALETTE = [
  '#6366F1',
  '#0EA5E9',
  '#14B8A6',
  '#22C55E',
  '#EAB308',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#64748B',
];

/** Cor determinística para tags criadas automaticamente. */
export function tagColorFor(name: string): string {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<TagDto[]> {
    const tags = await this.prisma.tag.findMany({
      where: { userId },
      include: { _count: { select: { transactions: true } } },
    });
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
    return tags
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        transactionCount: t._count.transactions,
      }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }

  async update(userId: string, id: string, dto: UpdateTagDto): Promise<TagDto> {
    await this.findOwned(userId, id);
    try {
      const tag = await this.prisma.tag.update({
        where: { id },
        data: { name: dto.name, color: dto.color },
        include: { _count: { select: { transactions: true } } },
      });
      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        transactionCount: tag._count.transactions,
      };
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.TAG_ALREADY_EXISTS) : error;
    }
  }

  /** Remove a tag; os vínculos com lançamentos caem por cascade. */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.tag.delete({ where: { id } });
  }

  /**
   * Resolve nomes → ids, criando as tags ausentes. Nomes são deduplicados sem diferenciar
   * maiúsculas (a coluna é citext) e mantêm a grafia da primeira ocorrência.
   */
  async resolveIds(
    tx: Prisma.TransactionClient,
    userId: string,
    names: string[],
  ): Promise<string[]> {
    const unique = new Map<string, string>();
    for (const name of names) {
      const key = name.toLocaleLowerCase('pt-BR');
      if (name && !unique.has(key)) unique.set(key, name);
    }
    if (!unique.size) return [];
    const wanted = [...unique.values()];
    await tx.tag.createMany({
      data: wanted.map((name) => ({ userId, name, color: tagColorFor(name) })),
      skipDuplicates: true,
    });
    const tags = await tx.tag.findMany({
      where: { userId, name: { in: wanted } },
      select: { id: true },
    });
    return tags.map((t) => t.id);
  }

  private async findOwned(userId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!tag) throw new AppException(ErrorCode.TAG_NOT_FOUND);
    return tag;
  }
}
