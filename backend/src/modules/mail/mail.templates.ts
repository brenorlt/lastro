import { LASTRO_LOGO_CONTENT_ID } from './mail-logo.js';
import type { MailKind } from './mail.types.js';

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

// Paleta e tipografia espelham as tokens de marca do frontend
// (frontend/src/app/globals.css: --ink, --ink-2, --ink-3, --canvas, --brass).
const INK = '#111316';
const INK_2 = '#3d4148';
const INK_3 = '#8a9099';
const CANVAS = '#f6f6f3';
const BORDER = '#e7e5e0';
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:17px;line-height:1.65;color:${INK_2}">${escapeHtml(p)}</p>`,
    )
    .join('');
  const button = action
    ? `<p style="margin:32px 0 16px"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${INK};color:#ffffff;font-size:16px;font-weight:600;padding:16px 32px;border-radius:10px;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${INK_3}">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:${CANVAS};font-family:${SANS}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:40px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px">
            <tr>
              <td style="padding:32px 40px 24px">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px"><img src="cid:${LASTRO_LOGO_CONTENT_ID}" width="36" height="36" alt="Lastro" style="display:block;border-radius:9px" /></td>
                    <td style="font-family:${SERIF};font-size:22px;font-weight:600;color:${INK};letter-spacing:-0.01em">Lastro</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px;border-top:1px solid ${BORDER}"></td>
            </tr>
            <tr>
              <td style="padding:36px 40px 8px">
                <h1 style="margin:0 0 24px;font-family:${SERIF};font-size:26px;line-height:1.35;font-weight:600;color:${INK}">${escapeHtml(title)}</h1>
                ${body}${button}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 32px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER}">
                  <tr>
                    <td style="padding-top:24px;font-size:13px;line-height:1.6;color:${INK_3}">
                      Lastro — suas finanças com clareza.<br>
                      © ${new Date().getFullYear()} Lastro. Todos os direitos reservados.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderMail(
  kind: MailKind,
  params: {
    name?: string;
    link?: string;
    appUrl: string;
    title?: string;
    text?: string;
    days?: number;
  },
): Rendered {
  const greeting = params.name ? `Olá, ${params.name}!` : 'Olá!';

  switch (kind) {
    case 'EMAIL_VERIFICATION': {
      const lines = [
        greeting,
        'Confirme seu e-mail para ativar sua conta no Lastro. O link é válido por 24 horas.',
        'Se você não criou uma conta, ignore esta mensagem.',
      ];
      return {
        subject: 'Confirme seu e-mail no Lastro',
        text: `${lines.join('\n\n')}\n\n${params.link}`,
        html: layout('Confirme seu e-mail', lines, {
          label: 'Confirmar e-mail',
          url: params.link ?? '',
        }),
      };
    }
    case 'ACCOUNT_ALREADY_EXISTS': {
      const loginUrl = `${params.appUrl}/entrar`;
      const lines = [
        greeting,
        'Alguém tentou criar uma conta no Lastro com este e-mail, mas você já possui cadastro.',
        'Se foi você, basta entrar. Esqueceu a senha? Use a opção "Esqueci minha senha" na tela de login.',
        'Se não foi você, pode ignorar esta mensagem — sua conta continua segura.',
      ];
      return {
        subject: 'Você já tem uma conta no Lastro',
        text: `${lines.join('\n\n')}\n\n${loginUrl}`,
        html: layout('Você já tem uma conta', lines, { label: 'Entrar no Lastro', url: loginUrl }),
      };
    }
    case 'PASSWORD_RESET': {
      const lines = [
        greeting,
        'Recebemos um pedido para redefinir sua senha. O link é válido por 1 hora e só pode ser usado uma vez.',
        'Se você não pediu a redefinição, ignore esta mensagem; sua senha atual continua valendo.',
      ];
      return {
        subject: 'Redefinição de senha do Lastro',
        text: `${lines.join('\n\n')}\n\n${params.link}`,
        html: layout('Redefinir senha', lines, {
          label: 'Redefinir senha',
          url: params.link ?? '',
        }),
      };
    }
    case 'NOTIFICATION': {
      const lines = [greeting, params.text ?? ''];
      const title = params.title ?? 'Novidades no Lastro';
      return {
        subject: title,
        text: `${lines.join('\n\n')}${params.link ? `\n\n${params.link}` : ''}\n\nVocê pode ajustar estes avisos em Configurações › Notificações.`,
        html: layout(
          title,
          [...lines, 'Você pode ajustar estes avisos em Configurações › Notificações.'],
          params.link ? { label: 'Abrir no Lastro', url: params.link } : undefined,
        ),
      };
    }
    case 'PASSWORD_CHANGED': {
      const lines = [
        greeting,
        'Sua senha do Lastro foi alterada e as demais sessões foram encerradas.',
        'Se não foi você, redefina sua senha imediatamente pela opção "Esqueci minha senha".',
      ];
      return {
        subject: 'Sua senha do Lastro foi alterada',
        text: lines.join('\n\n'),
        html: layout('Senha alterada', lines),
      };
    }
    case 'SUBSCRIPTION_EXPIRING_SOON': {
      const days = params.days ?? 3;
      const billingUrl = `${params.appUrl}/assinatura`;
      const lines = [
        greeting,
        `Seu acesso ao Lastro vence em ${days} dia${days === 1 ? '' : 's'}. Depois disso, o acesso é bloqueado até um novo pagamento.`,
        'Renove agora para não perder o acesso às suas finanças.',
      ];
      return {
        subject: `Seu acesso ao Lastro vence em ${days} dia${days === 1 ? '' : 's'}`,
        text: `${lines.join('\n\n')}\n\n${billingUrl}`,
        html: layout('Seu acesso está prestes a vencer', lines, {
          label: 'Renovar agora',
          url: billingUrl,
        }),
      };
    }
    case 'SUBSCRIPTION_EXPIRED': {
      const billingUrl = `${params.appUrl}/assinatura`;
      const lines = [
        greeting,
        'Seu acesso ao Lastro venceu e foi bloqueado até um novo pagamento.',
        'Seus dados continuam salvos: para voltar a usar, é só renovar.',
      ];
      return {
        subject: 'Seu acesso ao Lastro venceu',
        text: `${lines.join('\n\n')}\n\n${billingUrl}`,
        html: layout('Seu acesso venceu', lines, { label: 'Renovar agora', url: billingUrl }),
      };
    }
  }
}
