import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail.types.js';

/**
 * Transporte de desenvolvimento: não envia nada, apenas registra assunto e link.
 * O link (que contém o token) só é logado quando `exposeLinks` é true (development/test).
 */
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  constructor(private readonly exposeLinks: boolean) {}

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      {
        mail: {
          kind: message.kind,
          to: message.to,
          subject: message.subject,
          ...(this.exposeLinks && message.link ? { link: message.link } : {}),
        },
      },
      `E-mail (log): ${message.subject}`,
    );
    return Promise.resolve();
  }
}
