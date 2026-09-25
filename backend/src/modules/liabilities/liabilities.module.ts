import { Module } from '@nestjs/common';
import { LiabilitiesController } from './liabilities.controller.js';
import { LiabilitiesService } from './liabilities.service.js';

@Module({ controllers: [LiabilitiesController], providers: [LiabilitiesService] })
export class LiabilitiesModule {}
