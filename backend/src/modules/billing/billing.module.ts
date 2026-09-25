import { Module } from '@nestjs/common';
import { AbacatePayClient } from './abacatepay.client.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { SubscriptionExpiryJobService } from './subscription-expiry.job.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, AbacatePayClient, SubscriptionExpiryJobService],
  exports: [BillingService],
})
export class BillingModule {}
