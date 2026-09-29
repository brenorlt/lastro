import { Resend } from 'resend';
import type { MailMessage, MailTransport } from './mail.types.js';

/** Transporte de produção: envia via Resend (https://resend.com). */
export class ResendMailTransport implements MailTransport {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        contentId: attachment.contentId,
        content: attachment.content,
      })),
    });
    if (error) throw new Error(`Resend: ${error.name} — ${error.message}`);
  }
}
