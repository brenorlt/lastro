import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type AuthedClient, type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface CategoryBody {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  parentId: string | null;
  isDefault: boolean;
  transactionCount: number;
  children?: CategoryBody[];
}

describe('Categories (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let userId: string;

  const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
  const create = (body: Record<string, unknown>) =>
    client.post('/api/categories').send({ icon: 'tag', color: '#123456', ...body });
  const tree = async (query = '') =>
    data<CategoryBody[]>(await client.get(`/api/categories${query}`).expect(200));
  const find = (nodes: CategoryBody[], name: string) => nodes.find((n) => n.name === name);
  const addTransaction = (categoryId: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') =>
    ctx.prisma.transaction.create({
      data: { userId, categoryId, type, amount: '25.00', description: 'Teste', date: new Date() },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    const session = await registerAndLogin(ctx, 'categories');
    client = session.client;
    userId = session.userId;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('o cadastro semeia as categorias padrão; árvore ordenada com contagens', async () => {
    const all = await tree();
    expect(all).toHaveLength(15);
    const expense = await tree('?type=EXPENSE');
    expect(expense.map((c) => c.name)).toEqual([
      'Alimentação',
      'Assinaturas',
      'Compras',
      'Educação',
      'Impostos',
      'Lazer',
      'Moradia',
      'Outros',
      'Saúde',
      'Transporte',
    ]);
    expect(expense.every((c) => c.isDefault && c.children?.length === 0)).toBe(true);

    const food = find(expense, 'Alimentação');
    await addTransaction(food?.id ?? '');
    expect(find(await tree('?type=EXPENSE'), 'Alimentação')?.transactionCount).toBe(1);
  });

  it('cria subcategoria; rejeita profundidade 3, tipo diferente e pai alheio', async () => {
    const food = find(await tree('?type=EXPENSE'), 'Alimentação');
    const sub = data<CategoryBody>(
      await create({ name: 'Mercado', type: 'EXPENSE', parentId: food?.id }).expect(201),
    );
    expect(sub).toMatchObject({ parentId: food?.id, transactionCount: 0 });
    expect(sub).not.toHaveProperty('children');

    const deep = await create({ name: 'Hortifruti', type: 'EXPENSE', parentId: sub.id }).expect(
      400,
    );
    expect((deep.body as ErrorBody).code).toBe('INVALID_PARENT_CATEGORY');
    await create({ name: 'Bônus', type: 'INCOME', parentId: food?.id }).expect(400);

    const { client: other } = await quickUser(ctx, 'categories-other');
    const foreign = await other
      .post('/api/categories')
      .send({ name: 'X', type: 'EXPENSE', icon: 'tag', color: '#123456', parentId: food?.id })
      .expect(400);
    expect((foreign.body as ErrorBody).code).toBe('INVALID_PARENT_CATEGORY');
    const hidden = await other
      .patch(`/api/categories/${food?.id}`)
      .send({ name: 'Hack' })
      .expect(404);
    expect((hidden.body as ErrorBody).code).toBe('CATEGORY_NOT_FOUND');

    const children = find(await tree('?type=EXPENSE'), 'Alimentação')?.children ?? [];
    expect(children.map((c) => c.name)).toEqual(['Mercado']);
  });

  it('nomes duplicados (case-insensitive) por nível → 409 CATEGORY_ALREADY_EXISTS', async () => {
    const dupRoot = await create({ name: 'LAZER', type: 'EXPENSE' }).expect(409);
    expect((dupRoot.body as ErrorBody).code).toBe('CATEGORY_ALREADY_EXISTS');
    // Mesmo nome em outro tipo ou como subcategoria é permitido.
    await create({ name: 'Lazer', type: 'INCOME' }).expect(201);
    const food = find(await tree('?type=EXPENSE'), 'Alimentação');
    await create({ name: 'Lazer', type: 'EXPENSE', parentId: food?.id }).expect(201);
    await create({ name: 'mercado', type: 'EXPENSE', parentId: food?.id }).expect(409);
  });

  it('mover categoria com filhos para baixo de outra → 400; mover folha funciona', async () => {
    const expense = await tree('?type=EXPENSE');
    const food = find(expense, 'Alimentação');
    const transport = find(expense, 'Transporte');
    const moveParent = await client
      .patch(`/api/categories/${food?.id}`)
      .send({ parentId: transport?.id })
      .expect(400);
    expect((moveParent.body as ErrorBody).code).toBe('INVALID_PARENT_CATEGORY');

    const market = food?.children?.find((c) => c.name === 'Mercado');
    const moved = await client
      .patch(`/api/categories/${market?.id}`)
      .send({ parentId: null })
      .expect(200);
    expect(data<CategoryBody>(moved)).toMatchObject({ parentId: null, children: [] });
    await client.patch(`/api/categories/${market?.id}`).send({ parentId: food?.id }).expect(200);
    await client.patch(`/api/categories/${food?.id}`).send({ type: 'INCOME' }).expect(400);
  });

  it('exclusão em uso exige reassignTo; com reassign move lançamentos e exclui os filhos', async () => {
    const expense = await tree('?type=EXPENSE');
    const food = find(expense, 'Alimentação');
    const market = food?.children?.find((c) => c.name === 'Mercado');
    const other = find(expense, 'Outros');
    const income = find(await tree('?type=INCOME'), 'Salário');
    const tx = await addTransaction(market?.id ?? '');

    const blocked = await client.delete(`/api/categories/${food?.id}`).expect(409);
    expect((blocked.body as ErrorBody).code).toBe('CATEGORY_IN_USE');
    expect((blocked.body as ErrorBody).details).toEqual([
      { field: 'transactions', message: '2 lançamento(s)' },
    ]);

    await client.delete(`/api/categories/${food?.id}?reassignTo=${income?.id}`).expect(400);
    await client.delete(`/api/categories/${food?.id}?reassignTo=${market?.id}`).expect(400);

    await client.delete(`/api/categories/${food?.id}?reassignTo=${other?.id}`).expect(204);
    const moved = await ctx.prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(moved.categoryId).toBe(other?.id);

    const after = await tree('?type=EXPENSE');
    expect(find(after, 'Alimentação')).toBeUndefined();
    expect(find(after, 'Outros')?.transactionCount).toBe(2);
    await client.patch(`/api/categories/${market?.id}`).send({ name: 'x' }).expect(404);

    // Categoria sem uso é excluída direto.
    const leisure = find(after, 'Lazer');
    await client.delete(`/api/categories/${leisure?.id}`).expect(204);
  });

  it('restore-defaults recria só as ausentes', async () => {
    const restored = data<CategoryBody[]>(
      await client.post('/api/categories/restore-defaults').expect(200),
    );
    const expense = restored.filter((c) => c.type === 'EXPENSE');
    expect(find(expense, 'Alimentação')).toMatchObject({ isDefault: true, children: [] });
    expect(find(expense, 'Lazer')).toBeDefined();
    const count = await ctx.prisma.category.count({
      where: { userId, deletedAt: null, parentId: null, name: 'Outros', type: 'EXPENSE' },
    });
    expect(count).toBe(1);

    const again = data<CategoryBody[]>(
      await client.post('/api/categories/restore-defaults').expect(200),
    );
    expect(again).toHaveLength(restored.length);
  });
});
