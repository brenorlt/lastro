import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { type AuthedClient, type ErrorBody, quickUser, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
const error = (res: { body: unknown }) => res.body as ErrorBody;

/** supertest: corpo binário como Buffer. */
const binary = (res: request.Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Relatórios e exportação (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let token: string;
  let a: string;
  let b: string;
  let card: string;
  let food: string;
  let market: string;
  const MARCH = 'from=2026-03-01&to=2026-03-31';

  beforeAll(async () => {
    ctx = await createTestApp();
    const s = await registerAndLogin(ctx, 'reports');
    client = s.client;
    token = s.accessToken;
    const account = async (name: string) =>
      data<{ id: string }>(
        await client
          .post('/api/accounts')
          .send({ name, type: 'CHECKING', initialBalance: '0', color: '#111111', icon: 'wallet' })
          .expect(201),
      ).id;
    a = await account('Conta A');
    b = await account('Conta B');
    card = data<{ id: string }>(
      await client
        .post('/api/cards')
        .send({
          name: 'Cartão',
          brand: 'VISA',
          limit: '5000.00',
          closingDay: 3,
          dueDay: 10,
          color: '#000000',
        })
        .expect(201),
    ).id;
    const categories = data<{ id: string; name: string; type: string }[]>(
      await client.get('/api/categories').expect(200),
    );
    const cat = (name: string, type = 'EXPENSE') =>
      categories.find((c) => c.name === name && c.type === type)?.id;
    food = cat('Alimentação') ?? '';
    market = data<{ id: string }>(
      await client
        .post('/api/categories')
        .send({ name: 'Mercado', type: 'EXPENSE', icon: 'store', color: '#222222', parentId: food })
        .expect(201),
    ).id;
    const tx = (body: Record<string, unknown>) =>
      client
        .post('/api/transactions')
        .send({ description: 'Lançamento', ...body })
        .expect(201);
    await tx({
      type: 'INCOME',
      amount: '5000.00',
      date: '2026-03-05',
      accountId: a,
      categoryId: cat('Salário', 'INCOME'),
      description: 'Salário',
    });
    await tx({
      type: 'EXPENSE',
      amount: '200.00',
      date: '2026-03-10',
      accountId: a,
      categoryId: food,
    });
    await tx({
      type: 'EXPENSE',
      amount: '300.00',
      date: '2026-03-12',
      accountId: a,
      categoryId: market,
    });
    await tx({
      type: 'EXPENSE',
      amount: '150.00',
      date: '2026-03-15',
      creditCardId: card,
      categoryId: market,
    });
    await tx({
      type: 'EXPENSE',
      amount: '50.00',
      date: '2026-03-20',
      accountId: b,
      categoryId: cat('Moradia'),
      description: '=HYPERLINK("http://x")',
    });
    await tx({
      type: 'EXPENSE',
      amount: '100.00',
      date: '2026-02-20',
      accountId: a,
      categoryId: food,
    });
    await client
      .post('/api/transactions/transfers')
      .send({ fromAccountId: a, toAccountId: b, amount: '1000.00', date: '2026-03-25' })
      .expect(201);
    await client
      .post('/api/budgets')
      .send({ categoryId: food, month: '2026-03', limitAmount: '1000.00' })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('fluxo de caixa mensal (transferências fora), filtros e mesmo total da listagem', async () => {
    const r = data<{
      granularity: string;
      rows: Record<string, string>[];
      totals: Record<string, unknown>;
    }>(await client.get('/api/reports/cash-flow?from=2026-02-01&to=2026-03-31').expect(200));
    expect(r.rows).toEqual([
      {
        period: '2026-02',
        label: 'fev/2026',
        income: '0.00',
        expense: '100.00',
        net: '-100.00',
        cumulative: '-100.00',
      },
      {
        period: '2026-03',
        label: 'mar/2026',
        income: '5000.00',
        expense: '700.00',
        net: '4300.00',
        cumulative: '4200.00',
      },
    ]);
    expect(r.totals).toMatchObject({
      income: '5000.00',
      expense: '800.00',
      net: '4200.00',
      savingsRate: 84,
    });

    for (const filter of [
      `accountId=${a}`,
      `creditCardId=${card}`,
      `categoryId=${food}`,
      'type=EXPENSE',
    ]) {
      const report = data<{ totals: { income: string; expense: string } }>(
        await client.get(`/api/reports/cash-flow?${MARCH}&${filter}`).expect(200),
      );
      const list = (await client.get(`/api/transactions?${MARCH}&${filter}`).expect(200)).body as {
        meta: { totals: { income: string; expense: string } };
      };
      expect({ filter, ...report.totals }).toMatchObject({
        filter,
        income: list.meta.totals.income,
        expense: list.meta.totals.expense,
      });
    }
    const byAccount = data<{ totals: { expense: string } }>(
      await client.get(`/api/reports/cash-flow?${MARCH}&accountId=${a}`).expect(200),
    );
    expect(byAccount.totals.expense).toBe('500.00');
    const byCategory = data<{ totals: { expense: string } }>(
      await client.get(`/api/reports/cash-flow?${MARCH}&categoryId=${food}`).expect(200),
    );
    expect(byCategory.totals.expense).toBe('650.00');
  });

  it('granularidade diária/semanal e limites de período', async () => {
    const daily = data<{ granularity: string; rows: { period: string; expense: string }[] }>(
      await client
        .get('/api/reports/cash-flow?from=2026-03-01&to=2026-03-31&granularity=day')
        .expect(200),
    );
    expect(daily.granularity).toBe('day');
    expect(daily.rows).toHaveLength(31);
    expect(daily.rows.find((r) => r.period === '2026-03-12')?.expense).toBe('300.00');
    const capped = data<{ granularity: string }>(
      await client
        .get('/api/reports/cash-flow?from=2026-01-01&to=2026-06-30&granularity=day')
        .expect(200),
    );
    expect(capped.granularity).toBe('month');
    const weekly = data<{ rows: { period: string }[] }>(
      await client.get(`/api/reports/cash-flow?${MARCH}&granularity=week`).expect(200),
    );
    expect(weekly.rows[0].period).toBe('2026-W09');
    expect(
      error(await client.get('/api/reports/cash-flow?from=2020-01-01&to=2025-06-01').expect(400))
        .code,
    ).toBe('VALIDATION_ERROR');
    await client.get('/api/reports/cash-flow?from=2026-04-01&to=2026-03-01').expect(400);
  });

  it('categorias com subcategorias e comparação com o período anterior', async () => {
    const r = data<{
      total: string;
      rows: {
        name: string;
        amount: string;
        previousAmount: string;
        change: number | null;
        count: number;
        children: { name: string; amount: string }[];
      }[];
    }>(await client.get(`/api/reports/categories?${MARCH}`).expect(200));
    expect(r.total).toBe('700.00');
    expect(r.rows.map((c) => [c.name, c.amount, c.previousAmount, c.change, c.count])).toEqual([
      ['Alimentação', '650.00', '100.00', 550, 3],
      ['Moradia', '50.00', '0.00', null, 1],
    ]);
    expect(r.rows[0].children.map((c) => [c.name, c.amount])).toEqual([['Mercado', '450.00']]);
    const card$ = data<{ total: string }>(
      await client.get(`/api/reports/categories?${MARCH}&creditCardId=${card}`).expect(200),
    );
    expect(card$.total).toBe('150.00');
    const income = data<{ rows: { name: string }[] }>(
      await client.get(`/api/reports/categories?${MARCH}&type=INCOME`).expect(200),
    );
    expect(income.rows.map((c) => c.name)).toEqual(['Salário']);
    const sub = data<{ total: string }>(
      await client.get(`/api/reports/categories?${MARCH}&categoryId=${market}`).expect(200),
    );
    expect(sub.total).toBe('450.00');
  });

  it('demais relatórios: lançamentos, patrimônio, investimentos, metas e orçamento', async () => {
    const txs = (await client.get(`/api/reports/transactions?${MARCH}&pageSize=500`).expect(200))
      .body as { data: unknown[]; meta: { total: number; totals: { expense: string } } };
    expect(txs.meta.total).toBe(6);
    expect(txs.meta.totals.expense).toBe('700.00');
    await client.get(`/api/reports/transactions?${MARCH}&pageSize=501`).expect(400);

    const nw = data<{ rows: unknown[]; assets: { groups: unknown[] } }>(
      await client.get('/api/reports/net-worth?months=6').expect(200),
    );
    expect(nw.rows).toHaveLength(6);
    expect(nw.assets.groups).toHaveLength(5);
    await client.get('/api/reports/net-worth?months=61').expect(400);

    const inv = data<{ positions: unknown[]; contributionsByMonth: unknown[] }>(
      await client.get('/api/reports/investments').expect(200),
    );
    expect(inv).toMatchObject({ positions: [] });
    expect(inv.contributionsByMonth).toHaveLength(12);
    expect(
      data<{ rows: unknown[]; totals: { target: string } }>(
        await client.get('/api/reports/goals').expect(200),
      ).totals.target,
    ).toBe('0.00');

    const budget = data<{
      months: { month: string; totalSpent: string; items: { spent: string; level: string }[] }[];
    }>(await client.get('/api/reports/budget?fromMonth=2026-02&toMonth=2026-03').expect(200));
    expect(budget.months.map((m) => [m.month, m.totalSpent])).toEqual([
      ['2026-02', '0.00'],
      ['2026-03', '650.00'],
    ]);
    expect(budget.months[1].items[0]).toMatchObject({ spent: '650.00', level: 'ATTENTION' });
    await client.get('/api/reports/budget?fromMonth=2024-01&toMonth=2026-03').expect(400);
  });

  it('exporta CSV (BOM, ";", pt-BR, anti-injeção) e isola usuários', async () => {
    const res = await request(ctx.http)
      .get(`/api/reports/transactions/export?format=csv&${MARCH}`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="lastro-transactions-2026-03-01_2026-03-31.csv"',
    );
    const body = res.body as Buffer;
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = body.toString('utf8').slice(1).split('\r\n');
    expect(lines[0]).toBe('Data;Descrição;Tipo;Categoria;Conta/Cartão;Status;Valor');
    expect(lines).toContain('05/03/2026;Salário;Receita;Salário;Conta A;Confirmado;5000,00');
    expect(lines.find((l) => l.includes('HYPERLINK'))).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(lines.filter(Boolean)).toHaveLength(7);

    const other = await quickUser(ctx, 'reports-other');
    const otherRes = await other.client
      .get(`/api/reports/transactions/export?format=csv&${MARCH}`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    const otherLines = (otherRes.body as Buffer)
      .toString('utf8')
      .slice(1)
      .split('\r\n')
      .filter(Boolean);
    expect(otherLines).toEqual(['Data;Descrição;Tipo;Categoria;Conta/Cartão;Status;Valor']);
    const otherCats = data<{ total: string }>(
      await other.client.get(`/api/reports/categories?${MARCH}`).expect(200),
    );
    expect(otherCats.total).toBe('0.00');

    for (const kind of ['cash-flow', 'categories', 'net-worth', 'investments', 'goals', 'budget']) {
      const r = await request(ctx.http)
        .get(`/api/reports/${kind}/export?${MARCH}&fromMonth=2026-03&toMonth=2026-03`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse(binary);
      expect({ kind, status: r.status, bom: (r.body as Buffer)[0] }).toEqual({
        kind,
        status: 200,
        bom: 0xef,
      });
    }
    expect(error(await client.get('/api/reports/segredos/export').expect(404)).code).toBe(
      'NOT_FOUND',
    );
  });

  it('exporta PDF com páginas', async () => {
    for (const kind of ['cash-flow', 'transactions', 'categories', 'investments']) {
      const res = await request(ctx.http)
        .get(`/api/reports/${kind}/export?format=pdf&${MARCH}`)
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .parse(binary)
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(
        new RegExp(`^attachment; filename="lastro-${kind}-.+\\.pdf"$`),
      );
      const pdf = res.body as Buffer;
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(pdf.toString('latin1')).toMatch(/\/Type \/Page\b/);
    }
  });
});
