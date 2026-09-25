import { Decimal } from '../../common/utils/money.js';

export type BudgetLevel = 'OK' | 'ATTENTION' | 'WARNING' | 'EXCEEDED';

/** Percentual com 1 casa; limite 0 → 0. */
export function budgetPercent(spent: Decimal, limit: Decimal): number {
  if (limit.lessThanOrEqualTo(0)) return 0;
  return Number(spent.div(limit).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));
}

export function budgetLevel(percent: number): BudgetLevel {
  if (percent >= 100) return 'EXCEEDED';
  if (percent >= 80) return 'WARNING';
  if (percent >= 50) return 'ATTENTION';
  return 'OK';
}

export interface CategoryNode {
  id: string;
  parentId: string | null;
}

/** Categoria raiz de um id (a própria, se já for raiz). */
export function rootOf(categoryId: string, parents: ReadonlyMap<string, string | null>): string {
  return parents.get(categoryId) ?? categoryId;
}

/**
 * Sobreposição: orçar uma subcategoria cuja raiz já tem orçamento no mês (ou uma raiz
 * que já tem subcategoria orçada) contaria o gasto duas vezes.
 */
export function overlaps(candidate: CategoryNode, budgeted: CategoryNode[]): boolean {
  return budgeted.some(
    (b) =>
      (candidate.parentId !== null && b.id === candidate.parentId) ||
      (candidate.parentId === null && b.parentId === candidate.id),
  );
}

/** Gasto por orçamento: a própria categoria + subcategorias quando ela é raiz. */
export function spentByCategory(
  budgetCategoryIds: string[],
  spendByCategory: ReadonlyMap<string | null, Decimal>,
  parents: ReadonlyMap<string, string | null>,
): Map<string, Decimal> {
  const result = new Map(budgetCategoryIds.map((id) => [id, new Decimal(0)]));
  for (const [categoryId, amount] of spendByCategory) {
    if (!categoryId) continue;
    const direct = result.get(categoryId);
    if (direct) {
      result.set(categoryId, direct.plus(amount));
      continue;
    }
    const parent = parents.get(categoryId);
    const viaParent = parent ? result.get(parent) : undefined;
    if (parent && viaParent) result.set(parent, viaParent.plus(amount));
  }
  return result;
}

/** Gasto do mês fora de qualquer orçamento (uma subcategoria é coberta pelo orçamento da raiz). */
export function unbudgetedSpent(
  budgetCategoryIds: string[],
  spendByCategory: ReadonlyMap<string | null, Decimal>,
  parents: ReadonlyMap<string, string | null>,
): { unbudgeted: Decimal; uncategorized: Decimal } {
  const covered = new Set(budgetCategoryIds);
  let unbudgeted = new Decimal(0);
  let uncategorized = new Decimal(0);
  for (const [categoryId, amount] of spendByCategory) {
    if (!categoryId) {
      uncategorized = uncategorized.plus(amount);
      continue;
    }
    const parent = parents.get(categoryId);
    if (!covered.has(categoryId) && !(parent && covered.has(parent))) {
      unbudgeted = unbudgeted.plus(amount);
    }
  }
  return { unbudgeted, uncategorized };
}

/**
 * Limiares a marcar como disparados agora (só para cima, uma única vez por limiar).
 * Se vários forem cruzados de uma vez, todos são marcados mas só o maior notifica.
 */
export function thresholdsToFire(
  thresholds: number[],
  fired: number[],
  percent: number,
): { newlyFired: number[]; notify: number | null } {
  const newlyFired = [...new Set(thresholds)]
    .filter((t) => percent >= t && !fired.includes(t))
    .sort((a, b) => a - b);
  return { newlyFired, notify: newlyFired.length ? newlyFired[newlyFired.length - 1] : null };
}
