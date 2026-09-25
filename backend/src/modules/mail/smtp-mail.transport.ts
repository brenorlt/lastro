import type { MailMessage, MailTransport } from './mail.types.js';

/**
 * Stub do transporte SMTP (MAIL_TRANSPORT=smtp + SMTP_URL). Ainda não implementado:
 * a integração (ex.: nodemailer ou provedor HTTP) entra aqui sem mudar o MailService.
 */
export class SmtpMailTransport implements MailTransport {
  constructor(private readonly smtpUrl: string) {}

  send(_message: MailMessage): Promise<void> {
    void this.smtpUrl;
    return Promise.reject(
      new Error('MAIL_TRANSPORT=smtp ainda não foi implementado; use MAIL_TRANSPORT=log'),
    );
  }
}
