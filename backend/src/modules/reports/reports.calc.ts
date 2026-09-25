import { Decimal, toMoneyString } from '../../common/utils/money.js';
import { UNCATEGORIZED } from '../dashboard/dashboard.calc.js';

export interface CategoryMeta {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
}

export interface CategoryRow {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  amount: string;
  share: number;
  count: number;
  previousAmount: string;
  change: number | null;
  children?: CategoryRow[];
}

type Agg = { amount: Decimal; count: number };
type Node = { cur: Agg; prev: Decimal };
type RootNode = Node & { children: Map<string, Node> };
const pct1 = (v: Decimal) => Number(v.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1));

/**
 * Agrega por categoria raiz (subcategorias como `children`) comparando com o período anterior.
 * `change` = variação % vs. anterior (null se anterior = 0).
 */
export function buildCategoryReport(
  current: Map<string | null, Agg>,
  previous: Map<string | null, Agg>,
  categories: Map<string, CategoryMeta>,
): { total: string; rows: CategoryRow[] } {
  const total = [...current.values()].reduce((a, v) => a.plus(v.amount), new Decimal(0));
  const make = (
    meta: Omit<CategoryMeta, 'parentId'> | null,
    cur: Agg,
    prev: Decimal,
  ): CategoryRow => ({
    categoryId: meta?.id ?? null,
    name: meta?.name ?? UNCATEGORIZED.name,
    color: meta?.color ?? UNCATEGORIZED.color,
    icon: meta?.icon ?? UNCATEGORIZED.icon,
    amount: toMoneyString(cur.amount),
    share: total.isZero() ? 0 : pct1(cur.amount.div(total).times(100)),
    count: cur.count,
    previousAmount: toMoneyString(prev),
    change: prev.isZero() ? null : pct1(cur.amount.minus(prev).div(prev).times(100)),
  });

  const rootOf = (id: string | null) => {
    if (!id) return null;
    const meta = categories.get(id);
    return meta?.parentId ?? id;
  };
  const roots = new Map<string | null, RootNode>();
  const emptyNode = (): Node => ({
    cur: { amount: new Decimal(0), count: 0 },
    prev: new Decimal(0),
  });
  const touch = (id: string | null): { entry: RootNode; child: Node | null } => {
    const root = rootOf(id);
    const entry: RootNode = roots.get(root) ?? {
      ...emptyNode(),
      children: new Map<string, Node>(),
    };
    roots.set(root, entry);
    let child: Node | null = null;
    if (id && root !== id) {
      child = entry.children.get(id) ?? emptyNode();
      entry.children.set(id, child);
    }
    return { entry, child };
  };
  for (const [id, agg] of current) {
    const { entry, child } = touch(id);
    entry.cur = { amount: entry.cur.amount.plus(agg.amount), count: entry.cur.count + agg.count };
    if (child)
      child.cur = { amount: child.cur.amount.plus(agg.amount), count: child.cur.count + agg.count };
  }
  for (const [id, agg] of previous) {
    const { entry, child } = touch(id);
    entry.prev = entry.prev.plus(agg.amount);
    if (child) child.prev = child.prev.plus(agg.amount);
  }

  const byAmount = (a: CategoryRow, b: CategoryRow) =>
    Number(b.amount) - Number(a.amount) || a.name.localeCompare(b.name);
  const rows = [...roots.entries()]
    .filter(([, e]) => e.cur.amount.greaterThan(0) || e.prev.greaterThan(0))
    .map(([rootId, e]) => ({
      ...make(rootId ? (categories.get(rootId) ?? null) : null, e.cur, e.prev),
      children: [...e.children.entries()]
        .map(([id, c]) => make(categories.get(id) ?? null, c.cur, c.prev))
        .sort(byAmount),
    }))
    .sort(byAmount);
  return { total: toMoneyString(total), rows };
}
