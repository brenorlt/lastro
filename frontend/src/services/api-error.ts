import type { ApiErrorBody, ApiFieldError } from "@/types/api";

/** Mensagens exibidas ao usuário por código. Nunca mostramos texto técnico da API. */
const USER_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  VALIDATION_ERROR: "Alguns campos precisam de ajuste.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente para continuar.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  ACCOUNT_LOCKED: "Por segurança, o acesso foi pausado por alguns minutos após várias tentativas.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail para entrar. Enviamos um link para sua caixa de entrada.",
  TOKEN_INVALID: "Este link é inválido ou expirou. Solicite um novo.",
  TOKEN_EXPIRED: "Sua sessão expirou. Entre novamente para continuar.",
  SESSION_EXPIRED: "Sua sessão chegou ao limite de duração. Entre novamente.",
  SESSION_REVOKED: "Por segurança, sua sessão foi encerrada. Entre novamente.",
  INVALID_PASSWORD: "A senha atual não confere.",
  CSRF_REJECTED: "Não foi possível validar a origem da requisição. Recarregue a página.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  NOT_FOUND: "Não encontramos o que você procurava.",
  CONFLICT: "Já existe um registro com esses dados.",
  RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde um instante.",
  INTERNAL_ERROR: "Algo deu errado do nosso lado. Tente novamente em instantes.",
  SUBSCRIPTION_REQUIRED: "Seu período de teste acabou. Assine para continuar usando o Lastro.",
};

/** Códigos cuja mensagem da API é mais específica (ex.: minutos restantes do bloqueio). */
const SERVER_MESSAGE_CODES = new Set(["ACCOUNT_LOCKED"]);

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: ApiFieldError[];
  readonly requestId?: string;

  constructor(code: string, status: number, userMessage: string, fields: ApiFieldError[] = [], requestId?: string) {
    super(userMessage);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.requestId = requestId;
  }

  static fromBody(body: ApiErrorBody): ApiError {
    // Mensagens de domínio (ex.: "Conta não encontrada") já vêm em pt-BR da API;
    // para erros genéricos preferimos o texto local, mais humano.
    const generic = SERVER_MESSAGE_CODES.has(body.code) ? undefined : USER_MESSAGES[body.code];
    const message = body.statusCode >= 500 ? USER_MESSAGES.INTERNAL_ERROR : (generic ?? body.message);
    return new ApiError(body.code, body.statusCode, message, body.details, body.requestId);
  }

  static network(): ApiError {
    return new ApiError("NETWORK_ERROR", 0, USER_MESSAGES.NETWORK_ERROR);
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { success?: unknown }).success === false &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

export function userMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : USER_MESSAGES.INTERNAL_ERROR;
}
