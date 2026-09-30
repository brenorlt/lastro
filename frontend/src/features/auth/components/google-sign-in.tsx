import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/+$/, "");

export const googleLoginEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true";

/** Mensagens para /entrar?erro=… (definido pelo callback do backend). */
export const GOOGLE_LOGIN_ERRORS: Record<string, string> = {
  google_cancelado: "Login com Google cancelado.",
  google_email_nao_verificado: "Seu e-mail no Google não está verificado. Verifique-o no Google ou entre com e-mail e senha.",
  google_conta_indisponivel: "Esta conta não está disponível. Fale com o suporte.",
  google_indisponivel: "Login com Google indisponível no momento. Entre com e-mail e senha.",
  google_falhou: "Não foi possível entrar com o Google. Tente novamente.",
};

/**
 * Navegação de página inteira (não fetch): o backend redireciona para o Google e, no callback,
 * define os mesmos cookies de sessão do login por senha.
 */
export function GoogleSignIn({ next, label = "Continuar com Google" }: { next?: string; label?: string }) {
  if (!googleLoginEnabled) return null;
  const href = `${API_BASE}/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <div className="space-y-5">
      <Button asChild variant="secondary" size="lg" className="w-full">
        <a href={href} onClick={() => track("login_start", { method: "google" })}>
          <GoogleMark />
          {label}
        </a>
      </Button>
      <div className="flex items-center gap-3 text-xs text-ink-3" role="separator" aria-label="ou">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}
