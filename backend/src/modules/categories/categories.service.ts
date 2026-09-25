import { Injectable } from '@nestjs/common';
import { AppException, type ErrorDetail } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Category, Prisma } from '../../generated/prisma/client.js';
import type { CategoryType } from '../../generated/prisma/enums.js';
import { buildCategoryTree, type CategoryNode } from './category-tree.js';
import { DEFAULT_CATEGORIES } from './default-categories.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

type Db = Prisma.TransactionClient | PrismaService;

const CATEGORY_SELECT = {
  id: true,
  name: true,
  type: true,
  icon: true,
  color: true,
  parentId: true,
  isDefault: true,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

const invalidParent = () => new AppException(ErrorCode.INVALID_PARENT_CATEGORY);
const invalidTarget = (message: string) =>
  new AppException(ErrorCode.VALIDATION_ERROR, { details: [{ field: 'reassignTo', message }] });

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Árvore com contagem de lançamentos: 1 query de categorias + 1 groupBy (sem N+1). */
  async tree(userId: string, type?: CategoryType): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      where: { userId, deletedAt: null, ...(type ? { type } : {}) },
      select: CATEGORY_SELECT,
    });
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, deletedAt: null, categoryId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const g of grouped) if (g.categoryId) counts.set(g.categoryId, g._count._all);
    return buildCategoryTree(rows, counts);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryNode> {
    const parentId = dto.parentId ?? null;
    if (parentId) await this.assertValidParent(userId, parentId, dto.type);
    await this.assertNameAvailable(userId, dto.name, dto.type, parentId);

    try {
      const created = await this.prisma.category.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          icon: dto.icon,
          color: dto.color,
          parentId,
        },
        select: CATEGORY_SELECT,
      });
      return this.withCount(userId, created, parentId === null);
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.CATEGORY_ALREADY_EXISTS) : error;
    }
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryNode> {
    if (dto.name === null || dto.icon === null || dto.color === null) {
      throw new AppException(ErrorCode.VALIDATION_ERROR, {
        details: [{ message: 'name, icon e color não podem ser nulos' }],
      });
    }
    const current = await this.findOwned(userId, id);
    const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;

    if (parentId !== current.parentId && parentId !== null) {
      if (parentId === id) throw invalidParent();
      const children = await this.prisma.category.count({
        where: { userId, parentId: id, deletedAt: null },
      });
      // Profundidade máxima 2: quem tem filhos não pode virar subcategoria.
      if (children > 0) throw invalidParent();
      await this.assertValidParent(userId, parentId, current.type);
    }

    const name = dto.name ?? current.name;
    if (name.toLowerCase() !== current.name.toLowerCase() || parentId !== current.parentId) {
      await this.assertNameAvailable(userId, name, current.type, parentId, id);
    }

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data: { name: dto.name, icon: dto.icon, color: dto.color, parentId },
        select: CATEGORY_SELECT,
      });
      return this.withCount(userId, updated, updated.parentId === null);
    } catch (error) {
      throw isUniqueViolation(error) ? new AppException(ErrorCode.CATEGORY_ALREADY_EXISTS) : error;
    }
  }

  /**
   * Soft delete da categoria e de suas subcategorias. Com uso (lançamentos, recorrências,
   * orçamentos) exige `reassignTo`: lançamentos e recorrências migram para o destino e os
   * orçamentos das categorias excluídas são removidos (hard delete), tudo numa transação.
   */
  async remove(userId: string, id: string, reassignTo?: string): Promise<void> {
    const category = await this.findOwned(userId, id);
    const children = await this.prisma.category.findMany({
      where: { userId, parentId: id, deletedAt: null },
      select: { id: true },
    });
    const ids = [id, ...children.map((c) => c.id)];

    const [transactions, recurring, budgets] = await Promise.all([
      this.prisma.transaction.count({
        where: { userId, deletedAt: null, categoryId: { in: ids } },
      }),
      this.prisma.recurringTransaction.count({
        where: { userId, deletedAt: null, categoryId: { in: ids } },
      }),
      this.prisma.budget.count({ where: { userId, categoryId: { in: ids } } }),
    ]);
    const inUse = transactions + recurring + budgets > 0;

    if (inUse && !reassignTo) {
      const details: ErrorDetail[] = [];
      if (transactions)
        details.push({ field: 'transactions', message: `${transactions} lançamento(s)` });
      if (recurring)
        details.push({ field: 'recurringTransactions', message: `${recurring} recorrência(s)` });
      if (budgets) details.push({ field: 'budgets', message: `${budgets} orçamento(s)` });
      throw new AppException(ErrorCode.CATEGORY_IN_USE, { details });
    }

    if (reassignTo) {
      if (ids.includes(reassignTo)) {
        throw invalidTarget('O destino não pode ser a própria categoria nem uma subcategoria dela');
      }
      const target = await this.prisma.category.findFirst({
        where: { id: reassignTo, userId, deletedAt: null },
      });
      if (!target) throw invalidTarget('Categoria de destino não encontrada');
      if (target.type !== category.type) throw invalidTarget('O destino deve ser do mesmo tipo');
    }

    await this.prisma.$transaction(async (tx) => {
      if (reassignTo) {
        await tx.transaction.updateMany({
          where: { userId, categoryId: { in: ids } },
          data: { categoryId: reassignTo },
        });
        await tx.recurringTransaction.updateMany({
          where: { userId, categoryId: { in: ids } },
          data: { categoryId: reassignTo },
        });
        await tx.budget.deleteMany({ where: { userId, categoryId: { in: ids } } });
      }
      await tx.category.updateMany({
        where: { userId, id: { in: ids } },
        data: { deletedAt: new Date() },
      });
    });
  }

  /** Recria (na raiz) as categorias padrão ausentes, comparando nome+tipo sem diferenciar caixa. */
  async restoreDefaults(userId: string): Promise<CategoryNode[]> {
    const existing = await this.prisma.category.findMany({
      where: { userId, parentId: null, deletedAt: null },
      select: { name: true, type: true },
    });
    const key = (name: string, type: string) => `${type}:${name.toLocaleLowerCase('pt-BR')}`;
    const present = new Set(existing.map((c) => key(c.name, c.type)));
    const missing = DEFAULT_CATEGORIES.filter((c) => !present.has(key(c.name, c.type)));
    if (missing.length) {
      await this.prisma.category.createMany({
        data: missing.map((c) => ({ ...c, userId, isDefault: true })),
        skipDuplicates: true,
      });
    }
    return this.tree(userId);
  }

  /** Um nó isolado (com filhos, se for raiz) no mesmo formato da árvore. */
  private async withCount(
    userId: string,
    row: Omit<CategoryNode, 'transactionCount' | 'children'>,
    isRoot: boolean,
  ): Promise<CategoryNode> {
    const children = isRoot
      ? await this.prisma.category.findMany({
          where: { userId, parentId: row.id, deletedAt: null },
          select: CATEGORY_SELECT,
        })
      : [];
    const ids = [row.id, ...children.map((c) => c.id)];
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, deletedAt: null, categoryId: { in: ids } },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const g of grouped) if (g.categoryId) counts.set(g.categoryId, g._count._all);
    if (!isRoot) return { ...row, transactionCount: counts.get(row.id) ?? 0 };
    return buildCategoryTree([row, ...children], counts)[0];
  }

  private async findOwned(userId: string, id: string, db: Db = this.prisma): Promise<Category> {
    const category = await db.category.findFirst({ where: { id, userId, deletedAt: null } });
    if (!category) throw new AppException(ErrorCode.CATEGORY_NOT_FOUND);
    return category;
  }

  private async assertValidParent(userId: string, parentId: string, type: CategoryType) {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, userId, deletedAt: null },
      select: { type: true, parentId: true },
    });
    if (!parent || parent.type !== type || parent.parentId !== null) throw invalidParent();
  }

  /** `name` é citext: igualdade case-insensitive no próprio banco. */
  private async assertNameAvailable(
    userId: string,
    name: string,
    type: CategoryType,
    parentId: string | null,
    exceptId?: string,
  ) {
    const clash = await this.prisma.category.findFirst({
      where: {
        userId,
        name,
        deletedAt: null,
        ...(parentId === null ? { parentId: null, type } : { parentId }),
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new AppException(ErrorCode.CATEGORY_ALREADY_EXISTS);
  }
}
