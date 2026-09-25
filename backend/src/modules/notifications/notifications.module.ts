import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsJobService } from './notifications.job.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsJobService],
  exports: [NotificationsService, NotificationsJobService],
})
export class NotificationsModule {}
