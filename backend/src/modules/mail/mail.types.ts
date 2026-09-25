export type MailKind =
  | 'EMAIL_VERIFICATION'
  | 'ACCOUNT_ALREADY_EXISTS'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'NOTIFICATION';

export interface MailMessage {
  kind: MailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Link de ação contido no e-mail (só é logado em development/test). */
  link?: string;
}

/** Transporte de e-mail injetável (token MAIL_TRANSPORT). */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
