import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { TagsModule } from '../tags/tags.module.js';
import { RecurrenceService } from './recurrence.service.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

@Module({
  imports: [TagsModule, BudgetsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, RecurrenceService],
  exports: [TransactionsService, RecurrenceService],
})
export class TransactionsModule {}
