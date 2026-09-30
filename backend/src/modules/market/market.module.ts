import { Module } from '@nestjs/common';
import { MarketDataClient } from './market.client.js';
import { MarketController } from './market.controller.js';
import { MarketService } from './market.service.js';

/** Cotações públicas (câmbio e B3) para os insights do painel. */
@Module({
  controllers: [MarketController],
  providers: [MarketDataClient, MarketService],
})
export class MarketModule {}
