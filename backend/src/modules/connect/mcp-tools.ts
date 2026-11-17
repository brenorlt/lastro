import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { z } from 'zod';
import { AppException } from '../../common/errors/app.exception.js';
import { todayIn } from '../../common/utils/date-only.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { BudgetsService } from '../budgets/budgets.service.js';
import { CardsService } from '../cards/cards.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { EmergencyFundService } from '../emergency-fund/emergency-fund.service.js';
import { CreateContributionDto, ListGoalsQueryDto } from '../goals/goal.dto.js';
import { GoalsService } from '../goals/goals.service.js';
import { NetWorthService } from '../net-worth/net-worth.service.js';
import {
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from '../transactions/dto/transaction.dto.js';
import { TransactionsService } from '../transactions/transactions.service.js';

/* ------------------------------------------------------------------------ */
/* Respostas: JSON enxuto. Ícones, cores e carimbos de auditoria só gastam contexto. */

const DROP_KEYS = new Set([
  'icon',
  'color',
  'createdAt',
  'updatedAt',
  'userId',
  'deletedAt',
  'logoUrl',
  'sortOrder',
]);

export function compact(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (DROP_KEYS.has(k) || v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      out[k] = compact(v);
    }
    return out;
  }
  return value;
}

const ok = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(compact(data)) }],
});

const fail = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

/** Mesmas regras do ValidationPipe da API: o MCP chama os services direto, sem passar por ele. */
async function toDto<T extends object>(
  cls: ClassConstructor<T>,
  input: Record<string, unknown>,
): Promise<T> {
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const dto = plainToInstance(cls, clean);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) {
    const flat = errors.flatMap(function walk(e): string[] {
      return [...Object.values(e.constraints ?? {}), ...(e.children ?? []).flatMap(walk)];
    });
    throw new ToolInputError(flat.join('; ') || 'Dados inválidos.');
  }
  return dto;
}

class ToolInputError extends Error {}

function describeError(error: unknown): string {
  if (error instanceof ToolInputError) return error.message;
  if (error instanceof AppException) {
    const details = error.details
      ?.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
      .join('; ');
    return details ? `${error.message} (${details})` : error.message;
  }
  return 'Não foi possível concluir agora. Tente novamente.';
}

/* ------------------------------------------------------------------------ */
/* Esquemas compartilhados */

const money = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/)
  .describe('Valor positivo em reais, com ponto decimal. Ex.: "48.90"');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Data AAAA-MM-DD');
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe('Mês AAAA-MM');
const uuid = z.string().uuid();

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

export interface McpContext {
  userId: string;
  /** Assinatura bloqueada: ferramentas respondem com a orientação para assinar. */
  blocked: boolean;
  appUrl: string;
}

/**
 * Monta o servidor MCP de uma requisição, já amarrado ao usuário do token.
 * Toda ferramenta chama os services do domínio — as mesmas regras, escopo por userId
 * e validações da API valem aqui.
 */
@Injectable()
export class McpToolsFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly accounts: AccountsService,
    private readonly cards: CardsService,
    private readonly categories: CategoriesService,
    private readonly transactions: TransactionsService,
    private readonly budgets: BudgetsService,
    private readonly goals: GoalsService,
    private readonly emergency: EmergencyFundService,
    private readonly netWorth: NetWorthService,
  ) {}

  async create(ctx: McpContext): Promise<McpServer> {
    const user = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, timezone: true },
    });
    const today = todayIn(user?.timezone ?? 'America/Sao_Paulo');
    const { userId } = ctx;

    const server = new McpServer(
      { name: 'lastro', title: 'Lastro', version: '1.0.0', websiteUrl: ctx.appUrl },
      {
        instructions: [
          `Lastro é o app de finanças pessoais de ${user?.name ?? 'quem está conversando'}. Hoje é ${today} (fuso ${user?.timezone ?? 'America/Sao_Paulo'}).`,
          'Valores são strings em reais com ponto decimal ("1234.56"); datas AAAA-MM-DD; meses AAAA-MM.',
          'Antes de criar ou editar um lançamento, use listar_contas / listar_cartoes / listar_categorias para obter os ids — nunca invente ids.',
          'Sem categoria informada, o Lastro sugere uma automaticamente.',
          'Ao registrar ou alterar algo, confirme para a pessoa o que foi feito (valor, data, conta).',
          'Para apagar lançamentos, oriente a pessoa a usar o app — o conector não exclui dados.',
        ].join('\n'),
      },
    );

    /** Envolve cada ferramenta: assinatura, erros de domínio e de validação viram texto útil. */
    const run =
      <A>(fn: (args: A) => Promise<unknown>) =>
      async (args: A): Promise<CallToolResult> => {
        if (ctx.blocked) {
          return fail(
            `A assinatura do Lastro está inativa. Para continuar usando, assine em ${ctx.appUrl}/assinatura.`,
          );
        }
        try {
          return ok(await fn(args));
        } catch (error) {
          return fail(describeError(error));
        }
      };

    // ---------------------------------------------------------------- leitura

    server.registerTool(
      'resumo_financeiro',
      {
        title: 'Resumo financeiro do mês',
        description:
          'Visão geral: patrimônio líquido, saldo em contas, receitas e despesas do mês, quanto sobrou, reserva, compromissos a pagar, gastos por categoria, metas e leituras automáticas.',
        inputSchema: { mes: month.optional().describe('Mês AAAA-MM. Padrão: mês atual') },
        annotations: { title: 'Resumo financeiro', ...READ },
      },
      run(async ({ mes }: { mes?: string }) => {
        const d = await this.dashboard.get(userId, mes);
        return {
          mes: d.month,
          patrimonio: d.netWorth,
          saldoEmContas: d.cash.available,
          investimentos: d.investments.total,
          fluxoDoMes: d.flow,
          reserva: d.emergencyFund,
          compromissos: d.commitments,
          gastosPorCategoria: d.series.spendingByCategory.map((c) => ({
            categoria: c.name,
            valor: c.amount,
            percentual: c.share,
          })),
          metas: d.goals,
          proximosVencimentos: d.upcoming.map((t) => ({
            id: t.id,
            descricao: t.description,
            data: t.date,
            valor: t.amount,
            tipo: t.type,
          })),
          leituras: d.insights.map((i) => i.message),
        };
      }),
    );

    server.registerTool(
      'listar_contas',
      {
        title: 'Listar contas',
        description:
          'Contas bancárias, poupança e carteiras com saldo atual e id (use o id para lançar).',
        inputSchema: {},
        annotations: { title: 'Contas', ...READ },
      },
      run(async () => this.accounts.list(userId, { status: 'ACTIVE' })),
    );

    server.registerTool(
      'listar_cartoes',
      {
        title: 'Listar cartões de crédito',
        description:
          'Cartões com limite, uso, fatura atual, próxima fatura a vencer e id (use o id para lançar compras no cartão).',
        inputSchema: {},
        annotations: { title: 'Cartões', ...READ },
      },
      run(async () => this.cards.list(userId, 'ACTIVE')),
    );

    server.registerTool(
      'listar_categorias',
      {
        title: 'Listar categorias',
        description: 'Categorias de receita ou despesa (com subcategorias) e seus ids.',
        inputSchema: {
          tipo: z
            .enum(['INCOME', 'EXPENSE'])
            .optional()
            .describe('INCOME = receitas, EXPENSE = despesas'),
        },
        annotations: { title: 'Categorias', ...READ },
      },
      run(async ({ tipo }: { tipo?: 'INCOME' | 'EXPENSE' }) =>
        (await this.categories.tree(userId, tipo)).map((c) => ({
          id: c.id,
          nome: c.name,
          tipo: c.type,
          subcategorias: c.children?.map((s) => ({ id: s.id, nome: s.name })),
        })),
      ),
    );

    server.registerTool(
      'buscar_lancamentos',
      {
        title: 'Buscar lançamentos',
        description:
          'Lista receitas, despesas e transferências com filtros, do mais recente para o mais antigo, com totais do período (receitas, despesas, resultado).',
        inputSchema: {
          de: isoDate.optional().describe('Data inicial AAAA-MM-DD'),
          ate: isoDate.optional().describe('Data final AAAA-MM-DD'),
          busca: z
            .string()
            .max(100)
            .optional()
            .describe('Texto na descrição ou observação (ignora acentos)'),
          tipo: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
          contaId: uuid.optional(),
          categoriaId: uuid.optional().describe('Inclui subcategorias'),
          cartaoId: uuid.optional(),
          situacao: z
            .enum(['CLEARED', 'PENDING'])
            .optional()
            .describe('CLEARED = pago/recebido, PENDING = pendente'),
          valorMinimo: money.optional(),
          valorMaximo: money.optional(),
          pagina: z.number().int().min(1).optional(),
          porPagina: z.number().int().min(1).max(100).optional().describe('Padrão 30'),
        },
        annotations: { title: 'Buscar lançamentos', ...READ },
      },
      run(
        async (a: {
          de?: string;
          ate?: string;
          busca?: string;
          tipo?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          contaId?: string;
          categoriaId?: string;
          cartaoId?: string;
          situacao?: 'CLEARED' | 'PENDING';
          valorMinimo?: string;
          valorMaximo?: string;
          pagina?: number;
          porPagina?: number;
        }) => {
          const query = await toDto(ListTransactionsQueryDto, {
            from: a.de,
            to: a.ate,
            q: a.busca,
            type: a.tipo,
            accountId: a.contaId,
            categoryId: a.categoriaId,
            creditCardId: a.cartaoId,
            status: a.situacao,
            minAmount: a.valorMinimo,
            maxAmount: a.valorMaximo,
            page: a.pagina,
            pageSize: a.porPagina ?? 30,
          });
          return this.transactions.list(userId, query);
        },
      ),
    );

    server.registerTool(
      'ver_orcamentos',
      {
        title: 'Ver orçamentos do mês',
        description:
          'Limite, gasto, saldo e percentual de cada orçamento por categoria; nível OK, ATTENTION (50%), WARNING (80%) ou EXCEEDED.',
        inputSchema: { mes: month.optional().describe('Padrão: mês atual') },
        annotations: { title: 'Orçamentos', ...READ },
      },
      run(async ({ mes }: { mes?: string }) => this.budgets.list(userId, mes)),
    );

    server.registerTool(
      'ver_metas',
      {
        title: 'Ver metas',
        description:
          'Metas com valor alvo, guardado, prazo, quanto guardar por mês e se estão no ritmo.',
        inputSchema: {},
        annotations: { title: 'Metas', ...READ },
      },
      run(async () => this.goals.list(userId, await toDto(ListGoalsQueryDto, {}))),
    );

    server.registerTool(
      'ver_patrimonio',
      {
        title: 'Ver patrimônio e reserva',
        description:
          'Ativos, passivos e patrimônio líquido por grupo, mais a reserva de emergência (meta, valor e meses cobertos).',
        inputSchema: {},
        annotations: { title: 'Patrimônio', ...READ },
      },
      run(async () => {
        const [patrimonio, reserva] = await Promise.all([
          this.netWorth.get(userId, 6),
          this.emergency.get(userId),
        ]);
        return { patrimonio, reserva };
      }),
    );

    // ---------------------------------------------------------------- escrita

    server.registerTool(
      'criar_lancamento',
      {
        title: 'Registrar receita ou despesa',
        description:
          'Registra uma despesa (em conta ou no cartão de crédito) ou uma receita. Aceita compra parcelada (valor = total da compra) e lançamento recorrente. Para mover dinheiro entre contas use criar_transferencia.',
        inputSchema: {
          tipo: z.enum(['EXPENSE', 'INCOME']).describe('EXPENSE = despesa, INCOME = receita'),
          descricao: z.string().min(1).max(120),
          valor: money,
          data: isoDate.describe(
            'Data do lançamento AAAA-MM-DD. Hoje, se a pessoa não disser outra',
          ),
          contaId: uuid
            .optional()
            .describe('Conta (obrigatória para receita; para despesa, informe conta OU cartão)'),
          cartaoId: uuid.optional().describe('Cartão de crédito (só despesa)'),
          categoriaId: uuid.optional().describe('Se omitido, o Lastro sugere a categoria'),
          situacao: z
            .enum(['CLEARED', 'PENDING'])
            .optional()
            .describe('Padrão: pago se a data já passou, pendente se é futura'),
          observacoes: z.string().max(500).optional(),
          parcelas: z
            .number()
            .int()
            .min(2)
            .max(60)
            .optional()
            .describe('Compra parcelada: número de parcelas'),
          recorrencia: z
            .object({
              frequencia: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
              ate: isoDate.optional().describe('Última ocorrência (opcional)'),
            })
            .optional()
            .describe('Lançamento que se repete (ex.: aluguel mensal)'),
        },
        annotations: { title: 'Registrar lançamento', ...WRITE },
      },
      run(
        async (a: {
          tipo: 'EXPENSE' | 'INCOME';
          descricao: string;
          valor: string;
          data: string;
          contaId?: string;
          cartaoId?: string;
          categoriaId?: string;
          situacao?: 'CLEARED' | 'PENDING';
          observacoes?: string;
          parcelas?: number;
          recorrencia?: { frequencia: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; ate?: string };
        }) => {
          if (a.parcelas && a.recorrencia)
            throw new ToolInputError('Use parcelas OU recorrência, não os dois.');
          const repeat = a.parcelas
            ? { kind: 'INSTALLMENTS', count: a.parcelas }
            : a.recorrencia
              ? {
                  kind: 'RECURRING',
                  frequency: a.recorrencia.frequencia,
                  endDate: a.recorrencia.ate,
                }
              : undefined;
          const dto = await toDto(CreateTransactionDto, {
            type: a.tipo,
            description: a.descricao,
            amount: a.valor,
            date: a.data,
            accountId: a.contaId,
            creditCardId: a.cartaoId,
            categoryId: a.categoriaId,
            status: a.situacao,
            notes: a.observacoes,
            repeat,
          });
          const created = await this.transactions.create(userId, dto);
          return {
            criados: created.length,
            lancamentos: created.slice(0, 3),
            ...(created.length > 3 && {
              observacao: `+${created.length - 3} parcelas/ocorrências futuras`,
            }),
          };
        },
      ),
    );

    server.registerTool(
      'criar_transferencia',
      {
        title: 'Transferir entre contas',
        description: 'Move dinheiro de uma conta para outra (não conta como receita nem despesa).',
        inputSchema: {
          deContaId: uuid,
          paraContaId: uuid,
          valor: money,
          data: isoDate,
          descricao: z.string().min(1).max(120).optional(),
        },
        annotations: { title: 'Transferir', ...WRITE },
      },
      run(
        async (a: {
          deContaId: string;
          paraContaId: string;
          valor: string;
          data: string;
          descricao?: string;
        }) =>
          this.transactions.createTransfer(
            userId,
            await toDto(CreateTransferDto, {
              fromAccountId: a.deContaId,
              toAccountId: a.paraContaId,
              amount: a.valor,
              date: a.data,
              description: a.descricao,
            }),
          ),
      ),
    );

    server.registerTool(
      'editar_lancamento',
      {
        title: 'Editar lançamento',
        description:
          'Altera um lançamento existente (use buscar_lancamentos para achar o id). Só envie os campos que mudam. Em parcelados/recorrentes, escolha o escopo.',
        inputSchema: {
          id: uuid,
          escopo: z
            .enum(['single', 'future', 'all'])
            .optional()
            .describe('single = só este (padrão), future = este e os próximos, all = toda a série'),
          descricao: z.string().min(1).max(120).optional(),
          valor: money.optional(),
          data: isoDate.optional(),
          contaId: uuid.optional(),
          cartaoId: uuid.optional().describe('Move a despesa para este cartão'),
          categoriaId: uuid.optional(),
          situacao: z.enum(['CLEARED', 'PENDING']).optional(),
          observacoes: z.string().max(500).optional(),
        },
        annotations: { title: 'Editar lançamento', ...WRITE },
      },
      run(
        async (a: {
          id: string;
          escopo?: 'single' | 'future' | 'all';
          descricao?: string;
          valor?: string;
          data?: string;
          contaId?: string;
          cartaoId?: string;
          categoriaId?: string;
          situacao?: 'CLEARED' | 'PENDING';
          observacoes?: string;
        }) => {
          const dto = await toDto(UpdateTransactionDto, {
            description: a.descricao,
            amount: a.valor,
            date: a.data,
            accountId: a.contaId,
            creditCardId: a.cartaoId,
            categoryId: a.categoriaId,
            status: a.situacao,
            notes: a.observacoes,
          });
          if (Object.keys(dto).length === 0)
            throw new ToolInputError('Informe ao menos um campo para alterar.');
          const updated = await this.transactions.update(userId, a.id, dto, a.escopo ?? 'single');
          return { alterados: updated.length, lancamentos: updated.slice(0, 3) };
        },
      ),
    );

    server.registerTool(
      'marcar_como_pago',
      {
        title: 'Marcar como pago ou pendente',
        description:
          'Confirma que uma conta foi paga (ou uma receita recebida), ou volta para pendente.',
        inputSchema: {
          id: uuid,
          pago: z.boolean().describe('true = pago/recebido, false = pendente'),
        },
        annotations: { title: 'Marcar como pago', ...WRITE, idempotentHint: true },
      },
      run(async ({ id, pago }: { id: string; pago: boolean }) =>
        this.transactions.setStatus(userId, id, pago ? 'CLEARED' : 'PENDING'),
      ),
    );

    server.registerTool(
      'guardar_na_meta',
      {
        title: 'Guardar dinheiro numa meta',
        description:
          'Registra um aporte numa meta (valor negativo = retirada). Use ver_metas para achar o id.',
        inputSchema: {
          metaId: uuid,
          valor: z
            .string()
            .regex(/^-?\d{1,12}(\.\d{1,2})?$/)
            .describe('Ex.: "500.00"; negativo para retirada'),
          data: isoDate.optional().describe('Padrão: hoje (não pode ser futura)'),
          observacao: z.string().max(255).optional(),
        },
        annotations: { title: 'Aporte em meta', ...WRITE },
      },
      run(async (a: { metaId: string; valor: string; data?: string; observacao?: string }) =>
        this.goals.addContribution(
          userId,
          a.metaId,
          await toDto(CreateContributionDto, {
            amount: a.valor,
            date: a.data ?? today,
            note: a.observacao,
          }),
        ),
      ),
    );

    return server;
  }
}
