import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addDays, todayIn } from '../src/common/utils/date-only.js';
import { type AuthedClient, type ErrorBody, registerAndLogin } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface PreviewRow {
  externalId: string;
  date: string;
  description: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  status: 'NEW' | 'DUPLICATE' | 'IMPORTED' | 'UNSUPPORTED';
  categoryId: string | null;
}
interface Preview {
  format: string;
  statementKind: string | null;
  target: { kind: string; currentBalance: string | null };
  statementBalance: { amount: string; date: string } | null;
  signsInverted: boolean;
  rows: PreviewRow[];
}

const TODAY = todayIn('America/Sao_Paulo');
const d = (offset: number) => addDays(TODAY, offset);
const ofxDate = (date: string) => date.replaceAll('-', '');
const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
const error = (res: { body: unknown }) => res.body as ErrorBody;

function ofx(lines: [string, string, string][]): Buffer {
  const trns = lines
    .map(
      ([date, amount, memo], i) =>
        `<STMTTRN>\n<TRNTYPE>OTHER\n<DTPOSTED>${ofxDate(date)}\n<TRNAMT>${amount}\n<FITID>F${i}\n<MEMO>${memo}\n</STMTTRN>`,
    )
    .join('\n');
  return Buffer.from(
    `OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n${trns}\n</BANKTRANLIST>` +
      `<LEDGERBAL><BALAMT>5801.60<DTASOF>${ofxDate(TODAY)}</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
  );
}

describe('Importação de extrato (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let account: string;
  const category: Record<string, string> = {};

  const preview = (file: Buffer, fields: Record<string, string>, name = 'extrato.ofx') => {
    let req = client.post('/api/imports/preview').attach('file', file, name);
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req;
  };
  const balance = async () =>
    data<{ currentBalance: string }>(await client.get(`/api/accounts/${account}`).expect(200))
      .currentBalance;
  const toCommit = (rows: PreviewRow[]) =>
    rows.map(({ externalId, type, amount, description, date, categoryId }) => ({
      externalId,
      type,
      amount,
      description,
      date,
      categoryId,
    }));

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ client } = await registerAndLogin(ctx, 'imports'));
    account = data<{ id: string }>(
      await client
        .post('/api/accounts')
        .send({
          name: 'Corrente',
          type: 'CHECKING',
          initialBalance: '1000.00',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
    const tree = data<{ id: string; name: string; type: string }[]>(
      await client.get('/api/categories').expect(200),
    );
    for (const c of tree) category[`${c.type}:${c.name}`] = c.id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('prévia classifica, sugere categorias e não grava nada', async () => {
    // Lançado à mão um dia depois do que o banco registrou: possível duplicata.
    await client
      .post('/api/transactions')
      .send({
        type: 'EXPENSE',
        description: 'Padaria',
        amount: '45.90',
        date: d(-2),
        accountId: account,
      })
      .expect(201);
    // Histórico do usuário vence a palavra-chave ("posto" → Transporte).
    await client
      .post('/api/transactions')
      .send({
        type: 'EXPENSE',
        description: 'POSTO SHELL 123',
        amount: '10.00',
        date: d(-30),
        accountId: account,
        categoryId: category['EXPENSE:Lazer'],
      })
      .expect(201);

    const file = ofx([
      [d(-3), '-45.90', 'PADARIA DO BAIRRO'],
      [d(-10), '5000.00', 'CREDITO SALARIO'],
      [d(-8), '-32.50', 'UBER *TRIP'],
      [d(-5), '-200.00', 'POSTO SHELL 456'],
    ]);
    const body = data<Preview>(await preview(file, { accountId: account }).expect(200));

    expect(body).toMatchObject({
      format: 'OFX',
      statementKind: 'BANK',
      target: { kind: 'ACCOUNT', currentBalance: '944.10' },
      statementBalance: { amount: '5801.60', date: TODAY },
      signsInverted: false,
    });
    const byDesc = Object.fromEntries(body.rows.map((r) => [r.description, r]));
    expect(byDesc['PADARIA DO BAIRRO'].status).toBe('DUPLICATE');
    expect(byDesc['CREDITO SALARIO']).toMatchObject({
      status: 'NEW',
      type: 'INCOME',
      categoryId: category['INCOME:Salário'],
    });
    expect(byDesc['UBER *TRIP'].categoryId).toBe(category['EXPENSE:Transporte']);
    expect(byDesc['POSTO SHELL 456'].categoryId).toBe(category['EXPENSE:Lazer']);
    expect(await balance()).toBe('944.10');
  });

  it('importa as linhas escolhidas uma única vez e ajusta o saldo', async () => {
    const file = ofx([
      [d(-3), '-45.90', 'PADARIA DO BAIRRO'],
      [d(-10), '5000.00', 'CREDITO SALARIO'],
      [d(-8), '-32.50', 'UBER *TRIP'],
      [d(-5), '-200.00', 'POSTO SHELL 456'],
    ]);
    const first = data<Preview>(await preview(file, { accountId: account }).expect(200));
    const fresh = first.rows.filter((r) => r.status === 'NEW');
    expect(fresh).toHaveLength(3);

    const result = data<{ created: number; skipped: number }>(
      await client
        .post('/api/imports')
        .send({ accountId: account, rows: toCommit(fresh) })
        .expect(201),
    );
    expect(result).toEqual({ created: 3, skipped: 0 });
    expect(await balance()).toBe('5711.60');

    // Reenvio (duplo clique) não duplica.
    const again = data<{ created: number; skipped: number }>(
      await client
        .post('/api/imports')
        .send({ accountId: account, rows: toCommit(fresh) })
        .expect(201),
    );
    expect(again).toEqual({ created: 0, skipped: 3 });

    const second = data<Preview>(await preview(file, { accountId: account }).expect(200));
    expect(second.rows.filter((r) => r.status === 'IMPORTED')).toHaveLength(3);
    expect(second.rows.find((r) => r.description === 'PADARIA DO BAIRRO')?.status).toBe(
      'DUPLICATE',
    );

    const listed = data<{ description: string; status: string; category: { id: string } | null }[]>(
      await client.get(`/api/transactions?accountId=${account}&q=uber`).expect(200),
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      status: 'CLEARED',
      category: { id: category['EXPENSE:Transporte'] },
    });
  });

  it('excluir um importado libera a linha para ser importada de novo', async () => {
    const [uber] = data<{ id: string }[]>(
      await client.get(`/api/transactions?accountId=${account}&q=uber`).expect(200),
    );
    await client.delete(`/api/transactions/${uber.id}`).expect(204);
    const file = ofx([
      [d(-3), '-45.90', 'PADARIA DO BAIRRO'],
      [d(-10), '5000.00', 'CREDITO SALARIO'],
      [d(-8), '-32.50', 'UBER *TRIP'],
      [d(-5), '-200.00', 'POSTO SHELL 456'],
    ]);
    const body = data<Preview>(await preview(file, { accountId: account }).expect(200));
    const status = Object.fromEntries(body.rows.map((r) => [r.description, r.status]));
    expect(status).toMatchObject({ 'UBER *TRIP': 'NEW', 'POSTO SHELL 456': 'IMPORTED' });
  });

  it('cartão: CSV com compras positivas é invertido e pagamentos ficam de fora', async () => {
    const card = data<{ id: string }>(
      await client
        .post('/api/cards')
        .send({
          name: 'Roxinho',
          brand: 'MASTERCARD',
          limit: '3000.00',
          closingDay: 3,
          dueDay: 10,
          color: '#8A05BE',
        })
        .expect(201),
    ).id;
    const csv = Buffer.from(
      `date,title,amount\n${d(-6)},Netflix.com,55.90\n${d(-4)},Ifood *Restaurante,42.00\n${d(-1)},Pagamento recebido,-300.00`,
    );
    const body = data<Preview>(
      await preview(csv, { creditCardId: card }, 'nubank.csv').expect(200),
    );
    expect(body.signsInverted).toBe(true);
    const byDesc = Object.fromEntries(body.rows.map((r) => [r.description, r]));
    expect(byDesc['Netflix.com']).toMatchObject({
      type: 'EXPENSE',
      status: 'NEW',
      categoryId: category['EXPENSE:Assinaturas'],
    });
    expect(byDesc['Pagamento recebido']).toMatchObject({ type: 'INCOME', status: 'UNSUPPORTED' });

    const flipped = data<Preview>(
      await preview(csv, { creditCardId: card, invertSigns: 'true' }, 'nubank.csv').expect(200),
    );
    expect(flipped.signsInverted).toBe(false);

    const res = await client
      .post('/api/imports')
      .send({ creditCardId: card, rows: toCommit([byDesc['Pagamento recebido']]) })
      .expect(400);
    expect(error(res).code).toBe('VALIDATION_ERROR');

    const ok = data<{ created: number }>(
      await client
        .post('/api/imports')
        .send({
          creditCardId: card,
          rows: toCommit([byDesc['Netflix.com'], byDesc['Ifood *Restaurante']]),
        })
        .expect(201),
    );
    expect(ok.created).toBe(2);
    const cardBody = data<{ limitUsed: string }>(
      await client.get(`/api/cards/${card}`).expect(200),
    );
    expect(cardBody.limitUsed).toBe('97.90');
  });

  it('erros: arquivo ilegível, vazio, sem destino e categoria de outro tipo', async () => {
    const pdf = await preview(Buffer.from('%PDF-1.7 ...'), { accountId: account }, 'x.pdf').expect(
      400,
    );
    expect(error(pdf).code).toBe('IMPORT_UNREADABLE');
    expect(error(pdf).details?.[0].message).toMatch(/PDF/);

    const empty = await preview(ofx([]), { accountId: account }).expect(400);
    expect(error(empty).code).toBe('IMPORT_EMPTY');

    const noTarget = await preview(ofx([[d(-1), '-1.00', 'X']]), {}).expect(400);
    expect(error(noTarget).code).toBe('VALIDATION_ERROR');

    const [row] = data<Preview>(
      await preview(ofx([[d(-1), '-7.00', 'CAFE']]), { accountId: account }).expect(200),
    ).rows;
    const mismatch = await client
      .post('/api/imports')
      .send({
        accountId: account,
        rows: toCommit([{ ...row, categoryId: category['INCOME:Salário'] }]),
      })
      .expect(400);
    expect(error(mismatch).code).toBe('CATEGORY_TYPE_MISMATCH');
  });
});
