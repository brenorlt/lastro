import { Module } from '@nestjs/common';
import { InvestmentsModule } from '../investments/investments.module.js';
import { EmergencyFundModule } from '../emergency-fund/emergency-fund.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { SnapshotService } from './snapshot.service.js';

@Module({
  imports: [EmergencyFundModule, InvestmentsModule],
  controllers: [DashboardController],
  providers: [DashboardService, SnapshotService],
  exports: [DashboardService, SnapshotService],
})
export class DashboardModule {}
