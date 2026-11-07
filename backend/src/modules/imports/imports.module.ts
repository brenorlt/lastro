import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  imports: [TransactionsModule, CategoriesModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
