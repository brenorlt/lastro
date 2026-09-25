import { Injectable } from '@nestjs/common';
import { normalizeSearch } from '../../common/utils/search-text.js';
import { PrismaService } from '../../database/prisma.service.js';
import { toAccountDto } from '../accounts/accounts.service.js';
import { InvestmentsService } from '../investments/investments.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly investmentsService: InvestmentsService,
  ) {}

  async search(userId: string, q: string, limit: number) {
    const term = normalizeSearch(q);
    const matches = (...values: (string | null)[]) =>
      values.some((value) => value !== null && normalizeSearch(value).includes(term));

    // Contas e categorias são poucas por usuário: filtrar em memória permite ignorar acentos.
    const [transactions, accounts, categories, cards] = await Promise.all([
      this.transactions.search(userId, q, limit),
      this.prisma.account.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.category.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true, type: true, icon: true, color: true, parentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.creditCard.findMany({
        where: { userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          institution: true,
          brand: true,
          color: true,
          lastFourDigits: true,
          status: true,
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return {
      transactions,
      accounts: accounts
        .filter((a) => matches(a.name, a.institution))
        .slice(0, limit)
        .map(toAccountDto),
      categories: categories.filter((c) => matches(c.name)).slice(0, limit),
      cards: cards.filter((c) => matches(c.name, c.institution, c.lastFourDigits)).slice(0, limit),
      goals: [],
      investments: await this.investmentsService.search(userId, matches, limit),
    };
  }
}
