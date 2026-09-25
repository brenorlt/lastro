import { describe, expect, it } from '@jest/globals';
import { buildCategoryTree, type CategoryRow } from './category-tree.js';

const row = (id: string, name: string, parentId: string | null = null): CategoryRow => ({
  id,
  name,
  parentId,
  type: 'EXPENSE',
  icon: null,
  color: null,
  isDefault: false,
});

describe('buildCategoryTree', () => {
  it('agrupa filhos sob as raízes, ordena em pt-BR e aplica contagens', () => {
    const tree = buildCategoryTree(
      [
        row('t', 'Transporte'),
        row('a', 'alimentação'),
        row('e', 'Educação'),
        row('a2', 'Restaurante', 'a'),
        row('a1', 'Mercado', 'a'),
        row('t1', 'Ônibus', 't'),
      ],
      new Map([
        ['a', 2],
        ['a1', 5],
      ]),
    );

    expect(tree.map((n) => n.name)).toEqual(['alimentação', 'Educação', 'Transporte']);
    expect(tree[0].children?.map((n) => n.name)).toEqual(['Mercado', 'Restaurante']);
    expect(tree[0].transactionCount).toBe(2);
    expect(tree[0].children?.[0].transactionCount).toBe(5);
    expect(tree[1].children).toEqual([]);
    expect(tree[2].children?.[0]).not.toHaveProperty('children');
    expect(tree[2].children?.[0].transactionCount).toBe(0);
  });

  it('descarta filhos órfãos', () => {
    expect(buildCategoryTree([row('x', 'Órfã', 'sumiu')])).toEqual([]);
  });
});
