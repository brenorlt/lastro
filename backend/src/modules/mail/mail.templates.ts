import type { MailKind } from './mail.types.js';

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#6b7280">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${escapeHtml(action.url)}</p>`
    : '';
  return `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,sans-serif;color:#111827;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:20px">${escapeHtml(title)}</h1>${body}${button}<p style="font-size:12px;color:#6b7280">Lastro — suas finanças com clareza.</p></body></html>`;
}

export function renderMail(
  kind: MailKind,
  params: { name?: string; link?: string; appUrl: string; title?: string; text?: string },
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
  }
}
