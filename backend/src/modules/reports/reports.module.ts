import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { GoalsModule } from '../goals/goals.module.js';
import { InvestmentsModule } from '../investments/investments.module.js';
import { NetWorthModule } from '../net-worth/net-worth.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [TransactionsModule, NetWorthModule, InvestmentsModule, GoalsModule, BudgetsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
