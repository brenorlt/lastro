import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { addDays, todayIn } from '../src/common/utils/date-only.js';
import { NotificationsJobService } from '../src/modules/notifications/notifications.job.js';
import { RecurrenceService } from '../src/modules/transactions/recurrence.service.js';
import { type AuthedClient, type ErrorBody, quickUser } from './support/http.js';
import { createTestApp, type TestContext } from './support/test-app.js';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
}
interface ListBody {
  data: Notification[];
  meta: { page: number; pageSize: number; total: number; totalPages: number; unreadCount: number };
}

const data = <T>(res: { body: unknown }) => (res.body as { data: T }).data;
// Segunda-feira, dia 1º, 12h em São Paulo.
const NOW = new Date('2026-06-01T15:00:00Z');

describe('Notificações automáticas (e2e)', () => {
  let ctx: TestContext;
  let job: NotificationsJobService;

  beforeAll(async () => {
    ctx = await createTestApp();
    job = ctx.app.get(NotificationsJobService);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  async function craftedUser(label: string) {
    const { user, client } = await quickUser(ctx, label);
    await client
      .patch('/api/users/me')
      .send({ notificationPrefs: { weeklySummary: true } })
      .expect(200);
    const account = data<{ id: string }>(
      await client
        .post('/api/accounts')
        .send({
          name: 'Conta',
          type: 'CHECKING',
          initialBalance: '1000.00',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
    const bill = (description: string, date: string) =>
      client
        .post('/api/transactions')
        .send({
          type: 'EXPENSE',
          amount: '120.00',
          description,
          date,
          status: 'PENDING',
          accountId: account,
        })
        .expect(201);
    await bill('Aluguel', '2026-06-04'); // +3 dias
    await bill('Internet', '2026-06-01'); // hoje
    await bill('Luz', '2026-05-31'); // ontem
    await bill('Água', '2026-06-02'); // sem estágio
    const card = async (name: string, closingDay: number, dueDay: number, purchaseDate: string) => {
      const id = data<{ id: string }>(
        await client
          .post('/api/cards')
          .send({ name, brand: 'VISA', limit: '5000.00', closingDay, dueDay, color: '#000000' })
          .expect(201),
      ).id;
      await client
        .post('/api/transactions')
        .send({
          type: 'EXPENSE',
          amount: '300.00',
          description: 'Compra',
          date: purchaseDate,
          creditCardId: id,
        })
        .expect(201);
      return id;
    };
    const dueSoon = await card('Nubank', 30, 6, '2026-05-20'); // vence 06/06 (+5)
    const closing = await card('Inter', 1, 8, '2026-05-25'); // fecha hoje
    await client
      .post('/api/goals')
      .send({
        name: 'Carro',
        category: 'VEHICLE',
        targetAmount: '10000.00',
        targetDate: '2026-12-31',
      })
      .expect(201);
    await client
      .put('/api/emergency-fund')
      .send({ monthlyCost: '1000.00', targetMonths: 6, currentAmount: '1500.00' })
      .expect(200);
    return { user, client, account, dueSoon, closing };
  }

  it('gera o conjunto esperado, com e-mail nos tipos certos, e não duplica', async () => {
    const s = await craftedUser('notif-job');
    const created = await job.run(NOW, [s.user.id]);
    expect(created).toEqual({
      BILL_DUE: 3,
      INVOICE_DUE: 2,
      GOAL_BEHIND: 1,
      EMERGENCY_BELOW_TARGET: 1,
      WEEKLY_SUMMARY: 1,
    });

    const list = (await s.client.get('/api/notifications?pageSize=50').expect(200))
      .body as ListBody;
    const byTitle = list.data.map((n) => n.title).sort();
    expect(byTitle).toEqual(
      [
        'Vence em 3 dias: Aluguel',
        'Vence hoje: Internet',
        'Venceu ontem: Luz',
        'Fatura do Nubank vence em 5 dias',
        'Fatura do Inter fechou: R$ 300,00, vence 08/06',
        'Carro está abaixo do ritmo',
        'Sua reserva ainda não chegou à meta',
        'Seu resumo da semana',
      ].sort(),
    );
    const find = (type: string) => list.data.filter((n) => n.type === type);
    expect(find('BILL_DUE')[0].body).toMatch(/ · R\$ 120,00$/);
    expect(
      find('INVOICE_DUE')
        .map((n) => n.data.href)
        .sort(),
    ).toEqual([`/cartoes/${s.closing}`, `/cartoes/${s.dueSoon}`].sort());
    expect(find('GOAL_BEHIND')[0].body).toBe(
      'Carro está abaixo do ritmo: guarde R$ 1.666,67/mês para chegar em dez/2026.',
    );
    expect(find('EMERGENCY_BELOW_TARGET')[0]).toMatchObject({
      body: 'Sua reserva cobre 1,5 meses de 6 desejados.',
      data: { href: '/reserva' },
    });
    expect(find('WEEKLY_SUMMARY')[0].body).toContain('Semana de 25/05 a 31/05');
    expect(list.data.every((n) => typeof n.data.href === 'string')).toBe(true);
    expect(list.meta).toMatchObject({ total: 8, unreadCount: 8 });

    const email = (await ctx.prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })).email;
    const mails = ctx.mail.find(email, 'NOTIFICATION');
    expect(mails.map((m) => m.subject).sort()).toEqual(
      [
        'Vence em 3 dias: Aluguel',
        'Vence hoje: Internet',
        'Venceu ontem: Luz',
        'Fatura do Nubank vence em 5 dias',
        'Fatura do Inter fechou: R$ 300,00, vence 08/06',
        'Seu resumo da semana',
      ].sort(),
    );
    expect(mails[0].link).toMatch(/^http:\/\/localhost:3100\//);

    expect(await job.run(NOW, [s.user.id])).toEqual({});
    // Uma semana depois: novo resumo; meta ainda em carência de 30 dias; contas já passaram.
    const later = await job.run(new Date('2026-06-08T15:00:00Z'), [s.user.id]);
    expect(later.GOAL_BEHIND).toBeUndefined();
    expect(later.WEEKLY_SUMMARY).toBe(1);
  });

  it('preferências desligadas → nada', async () => {
    const s = await craftedUser('notif-off');
    await s.client
      .patch('/api/users/me')
      .send({
        notificationPrefs: {
          billsDue: false,
          invoiceDue: false,
          goalReminders: false,
          emergencyFund: false,
          weeklySummary: false,
        },
      })
      .expect(200);
    expect(await job.run(NOW, [s.user.id])).toEqual({});
    const channelsOff = await craftedUser('notif-channels-off');
    await channelsOff.client
      .patch('/api/users/me')
      .send({ notificationPrefs: { channels: { inApp: false, email: false } } })
      .expect(200);
    expect(await job.run(NOW, [channelsOff.user.id])).toEqual({});
  });

  it('e-mail ligado e in-app desligado: registra como lida e envia e-mail', async () => {
    const s = await craftedUser('notif-email-only');
    await s.client
      .patch('/api/users/me')
      .send({ notificationPrefs: { channels: { inApp: false } } })
      .expect(200);
    const created = await job.run(NOW, [s.user.id]);
    expect(created).toEqual({ BILL_DUE: 3, INVOICE_DUE: 2, WEEKLY_SUMMARY: 1 });
    const list = (await s.client.get('/api/notifications').expect(200)).body as ListBody;
    expect(list.meta.unreadCount).toBe(0);
  });

  it('recorrências e novos lançamentos', async () => {
    const { user, client } = await quickUser(ctx, 'notif-recurring');
    const account = data<{ id: string }>(
      await client
        .post('/api/accounts')
        .send({
          name: 'Conta',
          type: 'CHECKING',
          initialBalance: '0',
          color: '#111111',
          icon: 'wallet',
        })
        .expect(201),
    ).id;
    const today = todayIn('America/Sao_Paulo');
    await client
      .post('/api/transactions')
      .send({
        type: 'EXPENSE',
        amount: '50.00',
        description: 'Streaming',
        date: today,
        accountId: account,
        repeat: { kind: 'RECURRING', frequency: 'MONTHLY' },
      })
      .expect(201);
    const future = new Date(`${addDays(today, 95)}T15:00:00Z`);
    await ctx.app.get(RecurrenceService).run(future);
    const recurring = data<Notification[]>(
      await client.get('/api/notifications?type=RECURRING_CREATED').expect(200),
    );
    expect(recurring).toHaveLength(1);
    expect(recurring[0].title).toMatch(/^\d+ lançamentos? recorrentes? agendados?$/);
    expect(user.id).toBeDefined();

    await client
      .post('/api/transactions')
      .send({
        type: 'EXPENSE',
        amount: '9.90',
        description: 'Café',
        date: today,
        accountId: account,
      })
      .expect(201);
    expect(
      data<Notification[]>(await client.get('/api/notifications?type=NEW_TRANSACTION').expect(200)),
    ).toHaveLength(0);
    await client
      .patch('/api/users/me')
      .send({ notificationPrefs: { newTransactions: true } })
      .expect(200);
    await client
      .post('/api/transactions')
      .send({
        type: 'EXPENSE',
        amount: '12.00',
        description: 'Pão',
        date: today,
        accountId: account,
      })
      .expect(201);
    const news = data<Notification[]>(
      await client.get('/api/notifications?type=NEW_TRANSACTION').expect(200),
    );
    expect(news.map((n) => n.title)).toEqual(['Novo lançamento: Pão']);
  });

  it('API: paginação, unreadCount, leitura e exclusão', async () => {
    const s = await craftedUser('notif-api');
    await job.run(NOW, [s.user.id]);
    const client: AuthedClient = s.client;
    const page1 = (await client.get('/api/notifications?pageSize=3').expect(200)).body as ListBody;
    expect(page1.meta).toEqual({ page: 1, pageSize: 3, total: 8, totalPages: 3, unreadCount: 8 });
    expect(page1.data).toHaveLength(3);
    const page3 = (await client.get('/api/notifications?pageSize=3&page=3').expect(200))
      .body as ListBody;
    expect(page3.data).toHaveLength(2);
    const bills = (await client.get('/api/notifications?type=BILL_DUE').expect(200))
      .body as ListBody;
    expect(bills.meta.total).toBe(3);

    await client.post(`/api/notifications/${page1.data[0].id}/read`).expect(200);
    const unread = (await client.get('/api/notifications?unread=true').expect(200))
      .body as ListBody;
    expect(unread.meta).toMatchObject({ total: 7, unreadCount: 7 });

    await client.delete(`/api/notifications/${page1.data[1].id}`).expect(204);
    await client.delete(`/api/notifications/${page1.data[1].id}`).expect(404);
    expect((await client.delete('/api/notifications').expect(400)).body as ErrorBody).toMatchObject(
      { code: 'VALIDATION_ERROR' },
    );
    expect(
      data<{ deleted: number }>(await client.delete('/api/notifications?read=true').expect(200)),
    ).toEqual({ deleted: 1 });
    await client.post('/api/notifications/read-all').expect(200);
    expect(
      ((await client.get('/api/notifications').expect(200)).body as ListBody).meta,
    ).toMatchObject({ total: 6, unreadCount: 0 });
    await client.get('/api/notifications?pageSize=51').expect(400);

    const other = await quickUser(ctx, 'notif-api-other');
    await other.client.delete(`/api/notifications/${page1.data[2].id}`).expect(404);
    expect(
      ((await other.client.get('/api/notifications').expect(200)).body as ListBody).meta.total,
    ).toBe(0);
  });
});
