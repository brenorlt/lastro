import type { CategoryType } from '../../generated/prisma/enums.js';

export interface CategoryRow {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  isDefault: boolean;
}

export interface CategoryNode extends CategoryRow {
  transactionCount: number;
  children?: CategoryNode[];
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const byName = (a: { name: string }, b: { name: string }) => collator.compare(a.name, b.name);

/**
 * Monta a árvore (2 níveis) a partir de linhas planas. Raízes têm `children` (sempre array);
 * filhos não têm a chave. Filhos cujo pai não está na lista são descartados. Ordenação pt-BR.
 */
export function buildCategoryTree(
  rows: CategoryRow[],
  counts: ReadonlyMap<string, number> = new Map(),
): CategoryNode[] {
  const roots = new Map<string, CategoryNode & { children: CategoryNode[] }>();
  for (const row of rows) {
    if (row.parentId === null) {
      roots.set(row.id, { ...row, transactionCount: counts.get(row.id) ?? 0, children: [] });
    }
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    roots.get(row.parentId)?.children.push({ ...row, transactionCount: counts.get(row.id) ?? 0 });
  }
  const tree = [...roots.values()].sort(byName);
  for (const root of tree) root.children.sort(byName);
  return tree;
}
