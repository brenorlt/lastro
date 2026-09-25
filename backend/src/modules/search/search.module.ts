import { Module } from '@nestjs/common';
import { InvestmentsModule } from '../investments/investments.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [TransactionsModule, InvestmentsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
