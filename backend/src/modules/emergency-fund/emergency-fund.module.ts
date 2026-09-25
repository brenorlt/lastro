import { Module } from '@nestjs/common';
import { EmergencyFundController } from './emergency-fund.controller.js';
import { EmergencyFundService } from './emergency-fund.service.js';

@Module({
  controllers: [EmergencyFundController],
  providers: [EmergencyFundService],
  exports: [EmergencyFundService],
})
export class EmergencyFundModule {}
