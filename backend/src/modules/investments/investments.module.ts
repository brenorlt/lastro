import { Module } from '@nestjs/common';
import { InvestmentsController } from './investments.controller.js';
import { InvestmentsService } from './investments.service.js';

@Module({
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
