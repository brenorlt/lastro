import { Global, Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { LogMailTransport } from './log-mail.transport.js';
import { MailService } from './mail.service.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.types.js';
import { ResendMailTransport } from './resend-mail.transport.js';
import { SmtpMailTransport } from './smtp-mail.transport.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): MailTransport => {
        switch (config.get('MAIL_TRANSPORT')) {
          case 'resend':
            return new ResendMailTransport(
              config.get('RESEND_API_KEY') ?? '',
              config.get('MAIL_FROM'),
            );
          case 'smtp':
            return new SmtpMailTransport(config.get('SMTP_URL') ?? '');
          default:
            // O transporte log não envia nada; em produção isso costuma ser erro de configuração.
            if (config.nodeEnv === 'production') {
              new Logger('Mail').warn('MAIL_TRANSPORT=log em produção: nenhum e-mail será enviado');
            }
            return new LogMailTransport(config.isDevelopment || config.isTest);
        }
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
