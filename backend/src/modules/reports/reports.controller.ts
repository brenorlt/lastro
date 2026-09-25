import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { ApiErrors } from '../../common/swagger/api-responses.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  BudgetReportQueryDto,
  CashFlowQueryDto,
  ExportQueryDto,
  NetWorthReportQueryDto,
  REPORT_KINDS,
  type ReportKind,
  ReportFiltersDto,
  ReportTransactionsQueryDto,
} from './reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('cash-flow')
  @ApiOperation({ summary: 'Fluxo de caixa por dia/semana/mês (zero-filled) com totais' })
  @ApiOkResponse({ description: '{ from, to, granularity, rows[], totals }' })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  cashFlow(@CurrentUser() user: AuthUser, @Query() query: CashFlowQueryDto) {
    return this.reports.cashFlow(user.id, query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Totais por categoria raiz (com subcategorias) vs. período anterior' })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  categories(@CurrentUser() user: AuthUser, @Query() query: ReportFiltersDto) {
    return this.reports.categories(user.id, query);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Lançamentos filtrados (mesmo formato de /transactions, pageSize até 500)',
  })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  transactions(@CurrentUser() user: AuthUser, @Query() query: ReportTransactionsQueryDto) {
    return this.reports.transactionsReport(user.id, query);
  }

  @Get('net-worth')
  @ApiOperation({ summary: 'Evolução mensal do patrimônio + composição atual' })
  netWorth(@CurrentUser() user: AuthUser, @Query() query: NetWorthReportQueryDto) {
    return this.reports.netWorth(user.id, query.months ?? 12);
  }

  @Get('investments')
  @ApiOperation({ summary: 'Carteira: totais, classes, posições e aportes por mês' })
  investments(@CurrentUser() user: AuthUser) {
    return this.reports.investmentsReport(user.id);
  }

  @Get('goals')
  @ApiOperation({ summary: 'Metas não arquivadas com totais' })
  goals(@CurrentUser() user: AuthUser) {
    return this.reports.goalsReport(user.id);
  }

  @Get('budget')
  @ApiOperation({ summary: 'Orçado × realizado por mês (até 24 meses)' })
  @ApiErrors(ErrorCode.VALIDATION_ERROR)
  budget(@CurrentUser() user: AuthUser, @Query() query: BudgetReportQueryDto) {
    return this.reports.budget(user.id, query);
  }

  @Get(':kind/export')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiParam({ name: 'kind', enum: REPORT_KINDS })
  @ApiProduces('text/csv', 'application/pdf')
  @ApiOperation({
    summary: 'Exporta o relatório em CSV (pt-BR, ";" e vírgula decimal) ou PDF (A4)',
    description:
      'Aceita os mesmos filtros do relatório correspondente. Limite de 20 exportações/min.',
  })
  @ApiOkResponse({ description: 'Arquivo (attachment)' })
  @ApiErrors(ErrorCode.VALIDATION_ERROR, ErrorCode.NOT_FOUND, ErrorCode.RATE_LIMITED)
  async export(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: string,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!(REPORT_KINDS as readonly string[]).includes(kind)) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: 'Relatório não encontrado' });
    }
    const file = await this.reports.export(user.id, kind as ReportKind, query);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(file.body, { type: file.contentType, length: file.body.length });
  }
}
