import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { renderMail } from './mail.templates.js';
import { MAIL_TRANSPORT, type MailKind, type MailTransport } from './mail.types.js';

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
    params: { name?: string; link?: string; title?: string; text?: string } = {},
  ) {
    const rendered = renderMail(kind, { ...params, appUrl: this.appUrl });
    try {
      await this.transport.send({ kind, to, link: params.link, ...rendered });
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
