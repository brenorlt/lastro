import { Module } from '@nestjs/common';
import { NetWorthController } from './net-worth.controller.js';
import { NetWorthService } from './net-worth.service.js';

@Module({
  controllers: [NetWorthController],
  providers: [NetWorthService],
  exports: [NetWorthService],
})
export class NetWorthModule {}
