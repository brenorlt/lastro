import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addDays, addMonthsClamped, todayIn } from '../src/common/utils/date-only.js';
import { invoiceFor } from '../src/modules/cards/invoice.calc.js';
import { type AuthedClient, type ErrorBody, quickUser } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface Invoice {
  id: string | null;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  status: string;
  total: string;
  paidAmount: string;
  remaining: string;
}
interface Card {
  id: string;
  name: string;
  limit: string;
  limitUsed: string;
  availableLimit: string;
  usagePercent: number;
  overLimit: boolean;
  status: string;
  currentInvoice: Invoice | null;
  nextDueInvoice: Invoice | null;
}
interface Tx {
  id: string;
  date: string;
  amount: string;
  account: { id: string } | null;
  creditCard: { id: string; lastFourDigits: string | null } | null;
  invoice: { id: string; referenceMonth: string; dueDate: string } | null;
  installment: { number: number } | null;
  status: string;
}

const TODAY = todayIn('America/Sao_Paulo');
const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
const error = (res: { body: unknown }) => res.body as ErrorBody;

describe('Cartões e faturas (e2e)', () => {
  let ctx: TestContext;
  let client: AuthedClient;
  let account: string;
  let food: string;
  let card: string;
  const CYCLE = { closingDay: 3, dueDay: 10 };

  const balance = async () =>
    data<{ currentBalance: string }>(await client.get(`/api/accounts/${account}`).expect(200))
      .currentBalance;
  const getCard = async (id = card) => data<Card>(await client.get(`/api/cards/${id}`).expect(200));
  const invoice = async (ref: string, id = card) =>
    data<
      Invoice & {
        transactions: Tx[];
        payments: Tx[];
        byCategory: { name: string; amount: string }[];
      }
    >(await client.get(`/api/cards/${id}/invoices/${ref}`).expect(200));
  const purchase = (body: Record<string, unknown>) =>
    client.post('/api/transactions').send({
      type: 'EXPENSE',
      description: 'Compra',
      creditCardId: card,
      categoryId: food,
      ...body,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ client } = await quickUser(ctx, 'cards'));
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
    food = data<{ id: string }>(
      await client
        .post('/api/categories')
        .send({ name: 'Alimentação', type: 'EXPENSE', icon: 'utensils', color: '#EF4444' })
        .expect(201),
    ).id;
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('CRUD e validações do cartão', async () => {
    const created = data<Card>(
      await client
        .post('/api/cards')
        .send({
          name: 'Nubank',
          brand: 'MASTERCARD',
          limit: '5000.00',
          ...CYCLE,
          color: '#8A05BE',
          lastFourDigits: '1234',
          paymentAccountId: account,
        })
        .expect(201),
    );
    card = created.id;
    expect(created).toMatchObject({
      limit: '5000.00',
      limitUsed: '0.00',
      availableLimit: '5000.00',
      overLimit: false,
      status: 'ACTIVE',
    });
    expect(created.currentInvoice?.referenceMonth).toBe(invoiceFor(CYCLE, TODAY));
    expect(created.currentInvoice?.id).toBeNull();
    expect(created).toMatchObject({
      bestPurchaseDay: 3,
      paymentAccount: expect.objectContaining({ id: account }),
    });

    expect(
      error(
        await client
          .post('/api/cards')
          .send({ name: 'NUBANK', brand: 'VISA', limit: '1.00', ...CYCLE, color: '#000000' })
          .expect(409),
      ).code,
    ).toBe('CARD_NAME_TAKEN');
    await client
      .post('/api/cards')
      .send({
        name: 'X',
        brand: 'VISA',
        limit: '1.00',
        closingDay: 32,
        dueDay: 10,
        color: '#000000',
      })
      .expect(400);
    await client
      .post('/api/cards')
      .send({
        name: 'X',
        brand: 'VISA',
        limit: '1.00',
        ...CYCLE,
        color: '#000000',
        lastFourDigits: '12a4',
      })
      .expect(400);
    await client
      .post('/api/cards')
      .send({ name: 'X', brand: 'NUBANK', limit: '1.00', ...CYCLE, color: '#000000' })
      .expect(400);
    const patched = data<Card>(
      await client.patch(`/api/cards/${card}`).send({ limit: '6000.00' }).expect(200),
    );
    expect(patched.limit).toBe('6000.00');
    await client.patch(`/api/cards/${card}`).send({ name: null }).expect(400);
  });

  it('compra no cartão: fatura, limite, sem mexer na conta, conta como despesa', async () => {
    const [tx] = data<Tx[]>(await purchase({ amount: '300.00', date: '2026-01-15' }).expect(201));
    expect(tx).toMatchObject({ account: null, creditCard: { id: card, lastFourDigits: '1234' } });
    expect(tx.invoice).toMatchObject({ referenceMonth: '2026-02', dueDate: '2026-02-10' });
    expect(await balance()).toBe('1000.00');
    expect((await getCard()).limitUsed).toBe('300.00');

    expect((await invoice('2026-02')).total).toBe('300.00');
    const dashboard = data<{ flow: { expense: string } }>(
      await client.get('/api/dashboard?month=2026-01').expect(200),
    );
    expect(dashboard.flow.expense).toBe('300.00');
    const budget = data<{ spent: string }>(
      await client
        .post('/api/budgets')
        .send({ categoryId: food, month: '2026-01', limitAmount: '1000.00' })
        .expect(201),
    );
    expect(budget.spent).toBe('300.00');
    const list = (await client.get(`/api/transactions?creditCardId=${card}`).expect(200)).body as {
      meta: { totals: { expense: string } };
    };
    expect(list.meta.totals.expense).toBe('300.00');

    // Exatamente uma origem para despesas; receita não vai no cartão.
    await client
      .post('/api/transactions')
      .send({
        type: 'EXPENSE',
        amount: '1.00',
        description: 'X',
        date: TODAY,
        accountId: account,
        creditCardId: card,
      })
      .expect(400);
    await client
      .post('/api/transactions')
      .send({ type: 'EXPENSE', amount: '1.00', description: 'X', date: TODAY })
      .expect(400);
    await client
      .post('/api/transactions')
      .send({ type: 'INCOME', amount: '1.00', description: 'X', date: TODAY, creditCardId: card })
      .expect(400);
    // confirm/unconfirm em compra de cartão: no-op.
    expect(
      data<Tx>(await client.post(`/api/transactions/${tx.id}/unconfirm`).expect(200)).status,
    ).toBe(tx.status);
  });

  it('parcelado 3× em faturas consecutivas; compra no dia do fechamento vai para a próxima', async () => {
    const rows = data<Tx[]>(
      await purchase({
        amount: '600.00',
        date: '2026-01-20',
        repeat: { kind: 'INSTALLMENTS', count: 3 },
      }).expect(201),
    );
    expect(rows.map((r) => [r.date, r.invoice?.referenceMonth, r.amount])).toEqual([
      ['2026-01-20', '2026-02', '200.00'],
      ['2026-02-20', '2026-03', '200.00'],
      ['2026-03-20', '2026-04', '200.00'],
    ]);
    const [before] = data<Tx[]>(
      await purchase({ amount: '10.00', date: '2026-01-02' }).expect(201),
    );
    const [onClosing] = data<Tx[]>(
      await purchase({ amount: '20.00', date: '2026-01-03' }).expect(201),
    );
    expect(before.invoice?.referenceMonth).toBe('2026-01');
    expect(onClosing.invoice?.referenceMonth).toBe('2026-02');
    expect((await invoice('2026-02')).total).toBe('520.00'); // 300 + 200 + 20
    expect((await getCard()).limitUsed).toBe('930.00');
  });

  it('mover a data entre fechamentos e trocar cartão ↔ conta ajustam faturas e saldo', async () => {
    const [tx] = data<Tx[]>(await purchase({ amount: '50.00', date: '2025-12-30' }).expect(201));
    expect(tx.invoice?.referenceMonth).toBe('2026-01');
    expect((await invoice('2026-01')).total).toBe('60.00');

    const moved = data<Tx[]>(
      await client.patch(`/api/transactions/${tx.id}`).send({ date: '2026-01-05' }).expect(200),
    );
    expect(moved[0].invoice?.referenceMonth).toBe('2026-02');
    expect((await invoice('2026-01')).total).toBe('10.00');
    expect((await invoice('2026-02')).total).toBe('570.00');

    const toAccount = data<Tx[]>(
      await client.patch(`/api/transactions/${tx.id}`).send({ accountId: account }).expect(200),
    );
    expect(toAccount[0]).toMatchObject({
      creditCard: null,
      invoice: null,
      account: { id: account },
    });
    expect(await balance()).toBe('950.00');
    expect((await invoice('2026-02')).total).toBe('520.00');

    const back = data<Tx[]>(
      await client.patch(`/api/transactions/${tx.id}`).send({ creditCardId: card }).expect(200),
    );
    expect(back[0]).toMatchObject({
      account: null,
      invoice: expect.objectContaining({ referenceMonth: '2026-02' }),
    });
    expect(await balance()).toBe('1000.00');
    expect((await invoice('2026-02')).total).toBe('570.00');

    await client.delete(`/api/transactions/${tx.id}`).expect(204);
    expect((await invoice('2026-02')).total).toBe('520.00');
  });

  it('lista de faturas com meses virtuais, detalhe por categoria, série de gastos e vencida', async () => {
    const list = data<Invoice[]>(
      await client.get(`/api/cards/${card}/invoices?from=2025-12&to=2026-05`).expect(200),
    );
    expect(list.map((i) => [i.referenceMonth, i.total, i.id === null])).toEqual([
      ['2025-12', '0.00', true],
      ['2026-01', '10.00', false],
      ['2026-02', '520.00', false],
      ['2026-03', '200.00', false],
      ['2026-04', '200.00', false],
      ['2026-05', '0.00', true],
    ]);
    expect(list[2]).toMatchObject({
      closingDate: '2026-02-03',
      dueDate: '2026-02-10',
      status: 'OVERDUE',
      remaining: '520.00',
    });
    const detail = await invoice('2026-02');
    expect(detail.transactions).toHaveLength(3);
    expect(detail.byCategory).toEqual([
      expect.objectContaining({ name: 'Alimentação', amount: '520.00' }),
    ]);
    const defaults = data<Invoice[]>(await client.get(`/api/cards/${card}/invoices`).expect(200));
    expect(defaults).toHaveLength(10);
    expect(defaults[6].referenceMonth).toBe(invoiceFor(CYCLE, TODAY));

    const spending = data<{ referenceMonth: string; total: string }[]>(
      await client.get(`/api/cards/${card}/spending?months=6`).expect(200),
    );
    expect(spending).toHaveLength(6);
    expect(spending.at(-1)?.referenceMonth).toBe(invoiceFor(CYCLE, TODAY));

    await client.get(`/api/cards/${card}/invoices/2026-13`).expect(400);
    const virtual = await invoice('2030-01');
    expect(virtual).toMatchObject({ id: null, total: '0.00', transactions: [] });
    expect((await getCard()).nextDueInvoice?.referenceMonth).toBe('2026-01');
  });

  it('pagamento parcial e total (CLOSED → PAID), excedente 400, excluir pagamento reverte', async () => {
    const closing = addDays(TODAY, -5);
    const due = addDays(TODAY, 5);
    const cycle = { closingDay: Number(closing.slice(8)), dueDay: Number(due.slice(8)) };
    const second = data<Card>(
      await client
        .post('/api/cards')
        .send({ name: 'Inter', brand: 'VISA', limit: '1000.00', ...cycle, color: '#FF7A00' })
        .expect(201),
    ).id;
    const [tx] = data<Tx[]>(
      await purchase({ creditCardId: second, amount: '200.00', date: addDays(TODAY, -10) }).expect(
        201,
      ),
    );
    const ref = tx.invoice?.referenceMonth ?? '';
    expect(ref).toBe(invoiceFor(cycle, addDays(TODAY, -10)));
    expect((await invoice(ref, second)).status).toBe('CLOSED');

    // Compromissos do dashboard incluem a fatura a vencer e as vencidas do outro cartão.
    const dash = data<{
      commitments: { next30Days: string; overdueCount: number; overdueAmount: string };
      cards: { totalUsed: string; nextDue: { cardId: string } | null };
      netWorth: { liabilities: string };
    }>(await client.get('/api/dashboard').expect(200));
    expect(dash.commitments.next30Days).toBe('200.00');
    expect(dash.commitments.overdueCount).toBe(4); // faturas 2026-01..04 do primeiro cartão
    expect(dash.commitments.overdueAmount).toBe('930.00');
    expect(dash.cards.totalUsed).toBe('1130.00');
    expect(dash.netWorth.liabilities).toBe('1130.00');

    const partial = data<{ invoice: Invoice; payment: Tx & { type: string; description: string } }>(
      await client
        .post(`/api/cards/${second}/invoices/${ref}/pay`)
        .send({ accountId: account, amount: '50.00' })
        .expect(201),
    );
    expect(partial.invoice).toMatchObject({
      status: 'CLOSED',
      paidAmount: '50.00',
      remaining: '150.00',
    });
    expect(partial.payment).toMatchObject({
      type: 'TRANSFER',
      amount: '50.00',
      account: { id: account },
    });
    expect(partial.payment.description).toMatch(/^Pagamento fatura Inter [a-z]{3}\/\d{4}$/);
    expect(await balance()).toBe('950.00');

    const rest = data<{ invoice: Invoice }>(
      await client
        .post(`/api/cards/${second}/invoices/${ref}/pay`)
        .send({ accountId: account })
        .expect(201),
    );
    expect(rest.invoice).toMatchObject({ status: 'PAID', remaining: '0.00', paidAmount: '200.00' });
    expect(await balance()).toBe('800.00');
    expect((await getCard(second)).limitUsed).toBe('0.00');

    expect(
      error(
        await client
          .post(`/api/cards/${second}/invoices/${ref}/pay`)
          .send({ accountId: account, amount: '0.01' })
          .expect(400),
      ).code,
    ).toBe('PAYMENT_EXCEEDS_INVOICE');
    await client
      .post(`/api/cards/${second}/invoices/${ref}/pay`)
      .send({ accountId: account, amount: '1.00', date: addDays(TODAY, 1) })
      .expect(400);
    expect(
      error(
        await client
          .post(`/api/cards/${second}/invoices/2031-01/pay`)
          .send({ accountId: account })
          .expect(404),
      ).code,
    ).toBe('INVOICE_NOT_FOUND');

    await client.delete(`/api/transactions/${partial.payment.id}`).expect(204);
    const reverted = await invoice(ref, second);
    expect(reverted).toMatchObject({ status: 'CLOSED', paidAmount: '150.00', remaining: '50.00' });
    expect(reverted.payments).toHaveLength(1);
    expect(await balance()).toBe('850.00');
    await client.post(`/api/transactions/${partial.payment.id}/duplicate`).expect(404);
  });

  it('cartão arquivado bloqueia compras; exclusão em uso 409; posse 404; busca', async () => {
    const spare = data<Card>(
      await client
        .post('/api/cards')
        .send({
          name: 'Reserva',
          brand: 'ELO',
          limit: '100.00',
          ...CYCLE,
          color: '#000000',
          lastFourDigits: '9876',
        })
        .expect(201),
    ).id;
    await client.post(`/api/cards/${spare}/archive`).expect(200);
    expect(
      error(await purchase({ creditCardId: spare, amount: '1.00', date: TODAY }).expect(400)).code,
    ).toBe('CARD_UNAVAILABLE');
    const archivedList = (await client.get('/api/cards?status=ARCHIVED').expect(200)).body as {
      data: Card[];
    };
    expect(archivedList.data.map((c) => c.name)).toEqual(['Reserva']);
    const active = (await client.get('/api/cards').expect(200)).body as {
      data: Card[];
      meta: { totalLimit: string; totalUsed: string };
    };
    expect(active.data.map((c) => c.name)).toEqual(['Nubank', 'Inter']);
    expect(active.meta).toMatchObject({ totalLimit: '7000.00', totalUsed: '980.00' });

    const search = data<{ cards: { name: string }[] }>(
      await client.get('/api/search?q=9876').expect(200),
    );
    expect(search.cards.map((c) => c.name)).toEqual(['Reserva']);

    expect(error(await client.delete(`/api/cards/${card}`).expect(409)).code).toBe('CARD_IN_USE');
    await client.delete(`/api/cards/${spare}`).expect(204);
    await client.get(`/api/cards/${spare}`).expect(404);

    const other = await quickUser(ctx, 'cards-other');
    expect(error(await other.client.get(`/api/cards/${card}`).expect(404)).code).toBe(
      'CARD_NOT_FOUND',
    );
    await other.client.get(`/api/cards/${card}/invoices/2026-02`).expect(404);
    const otherAccount = data<{ id: string }>(
      await other.client
        .post('/api/accounts')
        .send({
          name: 'Outra',
          type: 'CHECKING',
          initialBalance: '0',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
    expect(
      error(
        await other.client
          .post('/api/transactions')
          .send({
            type: 'EXPENSE',
            amount: '1.00',
            description: 'X',
            date: TODAY,
            creditCardId: card,
          })
          .expect(404),
      ).code,
    ).toBe('CARD_NOT_FOUND');
    await other.client
      .post(`/api/cards/${card}/invoices/2026-02/pay`)
      .send({ accountId: otherAccount })
      .expect(404);
    await client
      .post(`/api/cards/${card}/invoices/2026-02/pay`)
      .send({ accountId: otherAccount })
      .expect(404);
  });

  // Contrato do PATCH: o par { accountId: null, creditCardId } do POST não vale na edição.
  it('PATCH com o corpo antigo do compositor (accountId: null) numa parcelada → 400 "Conta inválida", nada muda', async () => {
    const edit = data<Card>(
      await client
        .post('/api/cards')
        .send({ name: 'Edição', brand: 'VISA', limit: '1000.00', ...CYCLE, color: '#123456' })
        .expect(201),
    ).id;
    const rows = data<Tx[]>(
      await purchase({
        creditCardId: edit,
        amount: '259.98',
        date: '2026-01-15',
        repeat: { kind: 'INSTALLMENTS', count: 3 },
      }).expect(201),
    );
    expect(rows.map((r) => r.amount)).toEqual(['86.66', '86.66', '86.66']);
    const balanceBefore = await balance();
    const refs = rows.map((r) => r.invoice?.referenceMonth ?? '');

    for (const scope of ['single', 'future', 'all']) {
      const res = await client
        .patch(`/api/transactions/${rows[0].id}?scope=${scope}`)
        .send({
          amount: '86.65',
          description: 'Compra',
          date: '2026-01-15',
          status: rows[0].status,
          accountId: null,
          creditCardId: edit,
          categoryId: food,
          notes: null,
          tags: [],
        })
        .expect(400);
      expect(error(res).code).toBe('VALIDATION_ERROR');
      expect(error(res).details).toEqual([
        expect.objectContaining({ field: 'accountId', message: 'Conta inválida' }),
      ]);
    }

    for (const [i, row] of rows.entries()) {
      const after = data<Tx>(await client.get(`/api/transactions/${row.id}`).expect(200));
      expect(after).toMatchObject({ amount: '86.66', account: null, creditCard: { id: edit } });
      expect(after.invoice?.referenceMonth).toBe(refs[i]);
    }
    expect((await invoice(refs[0], edit)).total).toBe('86.66');
    expect(await balance()).toBe(balanceBefore);
  });

  // Preservação (3.4–3.7): o contrato do PATCH numa compra no cartão não muda com o bugfix.
  it('PATCH numa compra no cartão: ids nulos/vazios/malformados, ambos, cartão arquivado ou alheio → mesmos erros, nada muda', async () => {
    const own = data<Card>(
      await client
        .post('/api/cards')
        .send({ name: 'Contrato', brand: 'VISA', limit: '1000.00', ...CYCLE, color: '#654321' })
        .expect(201),
    ).id;
    const archived = data<Card>(
      await client
        .post('/api/cards')
        .send({
          name: 'Contrato arquivado',
          brand: 'ELO',
          limit: '100.00',
          ...CYCLE,
          color: '#000000',
        })
        .expect(201),
    ).id;
    await client.post(`/api/cards/${archived}/archive`).expect(200);
    const archivedAccount = data<{ id: string }>(
      await client
        .post('/api/accounts')
        .send({
          name: 'Contrato arquivada',
          type: 'CHECKING',
          initialBalance: '0',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
    await client.post(`/api/accounts/${archivedAccount}/archive`).expect(200);
    const other = await quickUser(ctx, 'cards-contract-other');
    const foreignCard = data<Card>(
      await other.client
        .post('/api/cards')
        .send({ name: 'Alheio', brand: 'VISA', limit: '100.00', ...CYCLE, color: '#000000' })
        .expect(201),
    ).id;

    const [tx] = data<Tx[]>(
      await purchase({ creditCardId: own, amount: '40.00', date: '2026-01-20' }).expect(201),
    );
    const ref = tx.invoice?.referenceMonth ?? '';
    expect((await invoice(ref, own)).total).toBe('40.00');
    const balanceBefore = await balance();

    const patch = (body: Record<string, unknown>) =>
      client.patch(`/api/transactions/${tx.id}`).send({ amount: '41.00', ...body });
    const expectField = async (body: Record<string, unknown>, field: string, message: string) => {
      const res = await patch(body).expect(400);
      expect(error(res).code).toBe('VALIDATION_ERROR');
      expect(error(res).details).toEqual([expect.objectContaining({ field, message })]);
    };

    for (const bad of [null, '', 'abc']) {
      await expectField({ accountId: bad }, 'accountId', 'Conta inválida');
      await expectField({ creditCardId: bad }, 'creditCardId', 'Cartão inválido');
    }
    await expectField(
      { accountId: account, creditCardId: own },
      'creditCardId',
      'Informe conta OU cartão, não ambos',
    );
    expect(error(await patch({ creditCardId: archived }).expect(400)).code).toBe(
      'CARD_UNAVAILABLE',
    );
    expect(error(await patch({ creditCardId: foreignCard }).expect(404)).code).toBe(
      'CARD_NOT_FOUND',
    );
    expect(error(await patch({ accountId: archivedAccount }).expect(400)).code).toBe(
      'ACCOUNT_ARCHIVED',
    );
    // 3.13: outro usuário não edita a compra.
    expect(
      error(
        await other.client.patch(`/api/transactions/${tx.id}`).send({ amount: '1.00' }).expect(404),
      ).code,
    ).toBe('TRANSACTION_NOT_FOUND');

    const after = data<Tx>(await client.get(`/api/transactions/${tx.id}`).expect(200));
    expect(after).toMatchObject({ amount: '40.00', account: null, creditCard: { id: own } });
    expect(after.invoice?.referenceMonth).toBe(ref);
    expect((await invoice(ref, own)).total).toBe('40.00');
    expect(await balance()).toBe(balanceBefore);
  });

  // Correção (2.1–2.4, 3.1, 3.2, 3.10): corpos iguais aos que `toTransactionPatch` produz.
  describe('PATCH com o corpo corrigido do compositor', () => {
    const newCard = async (name: string) =>
      data<Card>(
        await client
          .post('/api/cards')
          .send({ name, brand: 'VISA', limit: '5000.00', ...CYCLE, color: '#0F766E' })
          .expect(201),
      ).id;
    /** Corpo da edição sem troca de forma de pagamento (nem `accountId` nem `creditCardId`). */
    const editBody = (row: Tx, changes: Record<string, unknown> = {}) => ({
      amount: row.amount,
      description: 'Compra',
      date: row.date,
      status: row.status,
      categoryId: food,
      notes: null,
      tags: [],
      ...changes,
    });
    const getTx = async (id: string) =>
      data<Tx>(await client.get(`/api/transactions/${id}`).expect(200));
    const template = (id: string) =>
      ctx.prisma.recurringTransaction.findUniqueOrThrow({ where: { id } });
    /** Total esperado por fatura: soma dos valores das linhas em cada mês de referência. */
    const totalsByInvoice = (rows: Tx[]) => {
      const totals = new Map<string, number>();
      for (const r of rows) {
        const ref = r.invoice?.referenceMonth ?? '';
        totals.set(ref, (totals.get(ref) ?? 0) + Number(r.amount));
      }
      return totals;
    };
    const expectInvoiceTotals = async (rows: Tx[], cardId: string) => {
      for (const [ref, total] of totalsByInvoice(rows)) {
        expect([ref, (await invoice(ref, cardId)).total]).toEqual([ref, total.toFixed(2)]);
      }
    };

    it('parcelada no cartão, só valor, scope single/future/all → 200, continua no cartão e na mesma fatura', async () => {
      const own = await newCard('Corrigido parcelado');
      const rows = data<Tx[]>(
        await purchase({
          creditCardId: own,
          amount: '259.98',
          date: '2026-01-15',
          repeat: { kind: 'INSTALLMENTS', count: 3 },
        }).expect(201),
      );
      const refs = rows.map((r) => r.invoice?.referenceMonth ?? '');
      const balanceBefore = await balance();

      const edits: [number, string, string, number][] = [
        [0, 'single', '86.65', 1],
        [1, 'future', '86.64', 2],
        [2, 'all', '86.63', 3],
      ];
      for (const [i, scope, amount, affected] of edits) {
        const res = data<Tx[]>(
          await client
            .patch(`/api/transactions/${rows[i].id}?scope=${scope}`)
            .send(editBody(rows[i], { amount }))
            .expect(200),
        );
        expect(res).toHaveLength(affected);
      }

      // Parcelas não propagam valor: cada uma ficou com o valor da sua própria edição.
      const amounts = ['86.65', '86.64', '86.63'];
      for (const [i, row] of rows.entries()) {
        const after = await getTx(row.id);
        expect(after).toMatchObject({
          amount: amounts[i],
          account: null,
          creditCard: { id: own },
          installment: { number: i + 1 },
        });
        expect(after.invoice?.referenceMonth).toBe(refs[i]);
        expect((await invoice(refs[i], own)).total).toBe(amounts[i]);
      }
      expect(await balance()).toBe(balanceBefore);
    });

    it('recorrente no cartão, só valor, scope future/all → valor propaga, continua no cartão, modelo mantém creditCardId', async () => {
      const own = await newCard('Corrigido recorrente');
      const rows = data<Tx[]>(
        await purchase({
          creditCardId: own,
          amount: '50.00',
          date: addMonthsClamped(TODAY, -1),
          repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
        }).expect(201),
      );
      expect(rows.length).toBeGreaterThanOrEqual(3);
      const { recurringTransactionId } = await ctx.prisma.transaction.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      const templateId = recurringTransactionId ?? '';
      const refs = new Map(rows.map((r) => [r.id, r.invoice?.referenceMonth]));
      const balanceBefore = await balance();

      const future = data<Tx[]>(
        await client
          .patch(`/api/transactions/${rows[1].id}?scope=future`)
          .send(editBody(rows[1], { amount: '60.00' }))
          .expect(200),
      );
      expect(future.map((r) => r.id).sort()).toEqual(
        rows
          .slice(1)
          .map((r) => r.id)
          .sort(),
      );
      expect((await getTx(rows[0].id)).amount).toBe('50.00');
      expect(future.every((r) => r.amount === '60.00')).toBe(true);
      expect(await template(templateId)).toMatchObject({ creditCardId: own, accountId: null });
      expect((await template(templateId)).amount.toFixed(2)).toBe('60.00');

      const all = data<Tx[]>(
        await client
          .patch(`/api/transactions/${rows[2].id}?scope=all`)
          .send(editBody(rows[2], { amount: '70.00' }))
          .expect(200),
      );
      expect(all).toHaveLength(rows.length);
      for (const r of all) {
        expect(r).toMatchObject({ amount: '70.00', account: null, creditCard: { id: own } });
        expect(r.invoice?.referenceMonth).toBe(refs.get(r.id));
      }
      const tpl = await template(templateId);
      expect(tpl).toMatchObject({ creditCardId: own, accountId: null });
      expect(tpl.amount.toFixed(2)).toBe('70.00');
      await expectInvoiceTotals(all, own);
      expect(await balance()).toBe(balanceBefore);
    });

    it('troca conta ↔ cartão: { creditCardId } vai para a fatura e devolve o saldo; { accountId } volta e debita', async () => {
      const own = await newCard('Corrigido troca');
      const acc = data<{ id: string }>(
        await client
          .post('/api/accounts')
          .send({
            name: 'Corrigido troca',
            type: 'CHECKING',
            initialBalance: '500.00',
            color: '#111111',
            icon: 'wallet',
          })
          .expect(201),
      ).id;
      const accBalance = async () =>
        data<{ currentBalance: string }>(await client.get(`/api/accounts/${acc}`).expect(200))
          .currentBalance;
      const date = addDays(TODAY, -3);
      const ref = invoiceFor(CYCLE, date);
      const [tx] = data<Tx[]>(
        await client
          .post('/api/transactions')
          .send({
            type: 'EXPENSE',
            amount: '30.00',
            description: 'Compra',
            date,
            accountId: acc,
            categoryId: food,
          })
          .expect(201),
      );
      expect(tx.status).toBe('CLEARED');
      expect(await accBalance()).toBe('470.00');

      const [onCard] = data<Tx[]>(
        await client
          .patch(`/api/transactions/${tx.id}`)
          .send(editBody(tx, { creditCardId: own }))
          .expect(200),
      );
      expect(onCard).toMatchObject({ account: null, creditCard: { id: own } });
      expect(onCard.invoice?.referenceMonth).toBe(ref);
      expect((await invoice(ref, own)).total).toBe('30.00');
      expect(await accBalance()).toBe('500.00');

      const [onAccount] = data<Tx[]>(
        await client
          .patch(`/api/transactions/${tx.id}`)
          .send(editBody(onCard, { status: 'CLEARED', accountId: acc }))
          .expect(200),
      );
      expect(onAccount).toMatchObject({ account: { id: acc }, creditCard: null, invoice: null });
      expect((await invoice(ref, own)).total).toBe('0.00');
      expect(await accBalance()).toBe('470.00');
    });

    it('troca conta ↔ cartão numa série com scope=all vale para todos os membros e para o modelo', async () => {
      const own = await newCard('Corrigido troca série');
      const acc = data<{ id: string }>(
        await client
          .post('/api/accounts')
          .send({
            name: 'Corrigido troca série',
            type: 'CHECKING',
            initialBalance: '500.00',
            color: '#111111',
            icon: 'wallet',
          })
          .expect(201),
      ).id;
      const accBalance = async () =>
        data<{ currentBalance: string }>(await client.get(`/api/accounts/${acc}`).expect(200))
          .currentBalance;
      const rows = data<Tx[]>(
        await client
          .post('/api/transactions')
          .send({
            type: 'EXPENSE',
            amount: '25.00',
            description: 'Compra',
            date: addMonthsClamped(TODAY, -1),
            accountId: acc,
            categoryId: food,
            repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
          })
          .expect(201),
      );
      expect(rows.length).toBeGreaterThanOrEqual(3);
      const cleared = rows.filter((r) => r.status === 'CLEARED').length;
      const debited = (500 - 25 * cleared).toFixed(2);
      expect(await accBalance()).toBe(debited);
      const { recurringTransactionId } = await ctx.prisma.transaction.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      const templateId = recurringTransactionId ?? '';

      const toCard = data<Tx[]>(
        await client
          .patch(`/api/transactions/${rows[1].id}?scope=all`)
          .send(editBody(rows[1], { creditCardId: own }))
          .expect(200),
      );
      expect(toCard).toHaveLength(rows.length);
      for (const r of toCard) {
        expect(r).toMatchObject({ account: null, creditCard: { id: own } });
        expect(r.invoice?.referenceMonth).toBe(invoiceFor(CYCLE, r.date));
      }
      expect(await template(templateId)).toMatchObject({ creditCardId: own, accountId: null });
      await expectInvoiceTotals(toCard, own);
      expect(await accBalance()).toBe('500.00');

      const edited = toCard.find((r) => r.id === rows[1].id) ?? toCard[0];
      const toAccount = data<Tx[]>(
        await client
          .patch(`/api/transactions/${rows[1].id}?scope=all`)
          .send(editBody(edited, { status: rows[1].status, accountId: acc }))
          .expect(200),
      );
      expect(toAccount).toHaveLength(rows.length);
      for (const r of toAccount) {
        expect(r).toMatchObject({ account: { id: acc }, creditCard: null, invoice: null });
      }
      expect(await template(templateId)).toMatchObject({ accountId: acc, creditCardId: null });
      for (const ref of totalsByInvoice(toCard).keys()) {
        expect((await invoice(ref, own)).total).toBe('0.00');
      }
      expect(await accBalance()).toBe(debited);
    });
  });
});
