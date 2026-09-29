import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { LASTRO_LOGO_CONTENT_ID, LASTRO_LOGO_PNG_BASE64 } from './mail-logo.js';
import { renderMail } from './mail.templates.js';
import { MAIL_TRANSPORT, type MailKind, type MailTransport } from './mail.types.js';

const LOGO_ATTACHMENT = {
  filename: 'lastro.png',
  contentType: 'image/png',
  contentId: LASTRO_LOGO_CONTENT_ID,
  content: LASTRO_LOGO_PNG_BASE64,
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Envia um e-mail transacional. Falhas são registradas e não propagadas: fluxos
   * anti-enumeração (cadastro, esqueci a senha) devem responder igual em qualquer caso.
   */
  async send(
    kind: MailKind,
    to: string,
    params: { name?: string; link?: string; title?: string; text?: string; days?: number } = {},
  ) {
    const rendered = renderMail(kind, { ...params, appUrl: this.appUrl });
    try {
      await this.transport.send({
        kind,
        to,
        link: params.link,
        ...rendered,
        attachments: [LOGO_ATTACHMENT],
      });
    } catch (error) {
      this.logger.error(
        { kind, err: error instanceof Error ? error.message : String(error) },
        'Falha ao enviar e-mail',
      );
    }
  }

  get appUrl(): string {
    return this.config.get('APP_URL').replace(/\/+$/, '');
  }
}
