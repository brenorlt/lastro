import { Module } from '@nestjs/common';
import { EmergencyFundModule } from '../emergency-fund/emergency-fund.module.js';
import { PlanningController } from './planning.controller.js';
import { PlanningService } from './planning.service.js';

@Module({
  imports: [EmergencyFundModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
