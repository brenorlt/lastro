import { Decimal } from '../../common/utils/money.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { NetWorthInput } from './net-worth.calc.js';

/**
 * Dados brutos do patrimônio atual — fonte única para dashboard, /net-worth e planejamento.
 * Contas: ATIVAS com includeInNetWorth. Cartões: Σ em aberto por fatura (não excluídos).
 */
export async function loadNetWorthInput(
  prisma: PrismaService,
  userId: string,
): Promise<NetWorthInput> {
  const [accounts, investments, assets, liabilities, cards] = await Promise.all([
    prisma.account.findMany({
      where: { userId, deletedAt: null, status: 'ACTIVE', includeInNetWorth: true },
      select: { id: true, name: true, type: true, currentBalance: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.investment.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, currentValue: true },
    }),
    prisma.asset.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, type: true, value: true },
    }),
    prisma.liability.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, type: true, outstandingBalance: true },
    }),
    prisma.creditCard.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, invoices: { select: { total: true, paidAmount: true } } },
    }),
  ]);
  return {
    accounts: accounts.map((a) => ({ ...a, currentBalance: new Decimal(a.currentBalance) })),
    investments: investments.map((i) => ({ ...i, currentValue: new Decimal(i.currentValue) })),
    assets: assets.map((a) => ({ ...a, value: new Decimal(a.value) })),
    liabilities: liabilities.map((l) => ({
      ...l,
      outstandingBalance: new Decimal(l.outstandingBalance),
    })),
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      debt: c.invoices.reduce(
        (acc, i) => acc.plus(Decimal.max(new Decimal(i.total).minus(i.paidAmount), 0)),
        new Decimal(0),
      ),
    })),
  };
}
