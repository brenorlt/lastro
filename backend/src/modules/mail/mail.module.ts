import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { LogMailTransport } from './log-mail.transport.js';
import { MailService } from './mail.service.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.types.js';
import { SmtpMailTransport } from './smtp-mail.transport.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): MailTransport =>
        config.get('MAIL_TRANSPORT') === 'smtp'
          ? new SmtpMailTransport(config.get('SMTP_URL') ?? '')
          : new LogMailTransport(config.isDevelopment || config.isTest),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
