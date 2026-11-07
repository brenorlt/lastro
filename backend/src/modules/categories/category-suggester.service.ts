import { Injectable } from '@nestjs/common';
import { normalizeSearch } from '../../common/utils/search-text.js';
import { PrismaService } from '../../database/prisma.service.js';
import { keywordCategory, merchantKey } from './categorize.js';

type SuggestType = 'INCOME' | 'EXPENSE';

export interface SuggestedCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
}
export type CategorySuggestFn = (description: string, type: SuggestType) => string | null;

/** Quantos lançamentos categorizados do histórico alimentam a sugestão em lote (importação). */
const HISTORY_SIZE = 3000;
/** Candidatos lidos do histórico para sugerir a categoria de um único lançamento. */
const SINGLE_CANDIDATES = 200;

/**
 * Sugere a categoria de um lançamento a partir da descrição: primeiro o que o próprio usuário
 * escolheu por último para o mesmo estabelecimento (categorias automáticas ainda não confirmadas
 * não contam, para um palpite errado não se reforçar sozinho); senão, palavra-chave → categoria padrão com esse nome,
 * se ela existir (e não tiver sido apagada). Sem nenhum dos dois, não sugere nada.
 */
@Injectable()
export class CategorySuggesterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sugestão para muitas descrições de uma vez (carrega o histórico uma única vez). */
  async forUser(userId: string): Promise<CategorySuggestFn> {
    const [history, byName] = await Promise.all([
      this.prisma.transaction.findMany({
        where: this.historyWhere(userId),
        select: { description: true, type: true, categoryId: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: HISTORY_SIZE,
      }),
      this.categoriesByName(userId),
    ]);

    const learned = new Map<string, string>();
    for (const t of history) {
      const key = `${t.type}|${merchantKey(t.description)}`;
      if (!learned.has(key) && t.categoryId) learned.set(key, t.categoryId);
    }

    return (description, type) =>
      learned.get(`${type}|${merchantKey(description)}`) ??
      this.fromKeyword(byName, description, type);
  }

  /** Sugestão para um único lançamento (lançamento manual sem categoria). */
  async suggest(userId: string, description: string, type: SuggestType): Promise<string | null> {
    const key = merchantKey(description);
    if (!key) return null;

    // O índice trigram de search_text estreita a busca pela palavra mais longa; a comparação
    // exata da chave do estabelecimento é feita aqui.
    const anchor = key.split(' ').reduce((a, b) => (b.length > a.length ? b : a));
    const [candidates, byName] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { ...this.historyWhere(userId), type, searchText: { contains: anchor } },
        select: { description: true, categoryId: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: SINGLE_CANDIDATES,
      }),
      this.categoriesByName(userId),
    ]);

    const own = candidates.find((t) => merchantKey(t.description) === key)?.categoryId;
    return own ?? this.fromKeyword(byName, description, type);
  }

  /** Igual a `suggest`, com os dados da categoria para exibir (formulário de lançamento). */
  async suggestRef(
    userId: string,
    description: string,
    type: SuggestType,
  ): Promise<SuggestedCategory | null> {
    const id = await this.suggest(userId, description, type);
    if (!id) return null;
    return this.prisma.category.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, name: true, color: true, icon: true, parentId: true },
    });
  }

  private historyWhere(userId: string) {
    return {
      userId,
      deletedAt: null,
      categoryId: { not: null },
      categoryAuto: false,
      type: { in: ['INCOME' as const, 'EXPENSE' as const] },
      category: { deletedAt: null },
    };
  }

  private async categoriesByName(userId: string): Promise<Map<string, string>> {
    const categories = await this.prisma.category.findMany({
      where: { userId, deletedAt: null, parentId: null },
      select: { id: true, name: true, type: true },
    });
    return new Map(categories.map((c) => [`${c.type}|${normalizeSearch(c.name)}`, c.id]));
  }

  private fromKeyword(
    byName: Map<string, string>,
    description: string,
    type: SuggestType,
  ): string | null {
    const name = keywordCategory(description, type);
    return name ? (byName.get(`${type}|${normalizeSearch(name)}`) ?? null) : null;
  }
}
