import { HttpStatus } from '@nestjs/common';

/** Códigos estáveis de erro expostos no contrato da API (campo `code`). */
export const ErrorCode = {
  // Genéricos
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CSRF_REJECTED: 'CSRF_REJECTED',

  // Autenticação
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_ALREADY_IN_USE: 'EMAIL_ALREADY_IN_USE',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',

  // Domínio
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  CREDIT_CARD_NOT_FOUND: 'CREDIT_CARD_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  TAG_NOT_FOUND: 'TAG_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  RECURRING_TRANSACTION_NOT_FOUND: 'RECURRING_TRANSACTION_NOT_FOUND',
  BUDGET_NOT_FOUND: 'BUDGET_NOT_FOUND',
  GOAL_NOT_FOUND: 'GOAL_NOT_FOUND',
  INVESTMENT_NOT_FOUND: 'INVESTMENT_NOT_FOUND',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  LIABILITY_NOT_FOUND: 'LIABILITY_NOT_FOUND',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  ACCOUNT_NAME_TAKEN: 'ACCOUNT_NAME_TAKEN',
  ACCOUNT_IN_USE: 'ACCOUNT_IN_USE',
  CATEGORY_ALREADY_EXISTS: 'CATEGORY_ALREADY_EXISTS',
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  INVALID_PARENT_CATEGORY: 'INVALID_PARENT_CATEGORY',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CATEGORY_TYPE_MISMATCH: 'CATEGORY_TYPE_MISMATCH',
  ACCOUNT_ARCHIVED: 'ACCOUNT_ARCHIVED',
  SAME_ACCOUNT_TRANSFER: 'SAME_ACCOUNT_TRANSFER',
  TAG_ALREADY_EXISTS: 'TAG_ALREADY_EXISTS',
  ONBOARDING_ALREADY_COMPLETED: 'ONBOARDING_ALREADY_COMPLETED',
  BUDGET_ALREADY_EXISTS: 'BUDGET_ALREADY_EXISTS',
  BUDGET_OVERLAP: 'BUDGET_OVERLAP',
  GOAL_INSUFFICIENT_BALANCE: 'GOAL_INSUFFICIENT_BALANCE',
  CONTRIBUTION_NOT_FOUND: 'CONTRIBUTION_NOT_FOUND',
  EMERGENCY_FUND_NOT_FOUND: 'EMERGENCY_FUND_NOT_FOUND',
  EMERGENCY_FUND_LINKED: 'EMERGENCY_FUND_LINKED',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  CARD_NAME_TAKEN: 'CARD_NAME_TAKEN',
  CARD_IN_USE: 'CARD_IN_USE',
  CARD_UNAVAILABLE: 'CARD_UNAVAILABLE',
  PAYMENT_EXCEEDS_INVOICE: 'PAYMENT_EXCEEDS_INVOICE',
  INVESTMENT_INSUFFICIENT: 'INVESTMENT_INSUFFICIENT',
  INVESTMENT_TX_NOT_FOUND: 'INVESTMENT_TX_NOT_FOUND',
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE',
  LINKED_TRANSACTION: 'LINKED_TRANSACTION',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

interface ErrorDefinition {
  status: HttpStatus;
  message: string;
}

/** Status HTTP e mensagem padrão (pt-BR) de cada código. */
export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  VALIDATION_ERROR: { status: HttpStatus.BAD_REQUEST, message: 'Dados inválidos' },
  BAD_REQUEST: { status: HttpStatus.BAD_REQUEST, message: 'Requisição inválida' },
  UNAUTHORIZED: { status: HttpStatus.UNAUTHORIZED, message: 'Não autenticado' },
  FORBIDDEN: { status: HttpStatus.FORBIDDEN, message: 'Acesso negado' },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Recurso não encontrado' },
  CONFLICT: { status: HttpStatus.CONFLICT, message: 'Conflito com um registro existente' },
  PAYLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Corpo da requisição excede o tamanho permitido',
  },
  RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Muitas requisições. Tente novamente em instantes',
  },
  INTERNAL_ERROR: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno do servidor' },
  SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Serviço temporariamente indisponível',
  },
  CSRF_REJECTED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Requisição bloqueada: origem não permitida',
  },

  INVALID_CREDENTIALS: { status: HttpStatus.UNAUTHORIZED, message: 'E-mail ou senha incorretos' },
  TOKEN_EXPIRED: { status: HttpStatus.UNAUTHORIZED, message: 'Sessão expirada' },
  // Também usado com status 400 para links de e-mail (verificação/redefinição).
  TOKEN_INVALID: { status: HttpStatus.UNAUTHORIZED, message: 'Token inválido' },
  SESSION_REVOKED: { status: HttpStatus.UNAUTHORIZED, message: 'Sessão encerrada' },
  SESSION_EXPIRED: { status: HttpStatus.UNAUTHORIZED, message: 'Sessão expirada. Entre novamente' },
  INVALID_PASSWORD: { status: HttpStatus.BAD_REQUEST, message: 'Senha atual incorreta' },
  ACCOUNT_LOCKED: {
    status: HttpStatus.LOCKED,
    message: 'Conta bloqueada temporariamente por excesso de tentativas',
  },
  EMAIL_ALREADY_IN_USE: { status: HttpStatus.CONFLICT, message: 'E-mail já cadastrado' },
  EMAIL_NOT_VERIFIED: { status: HttpStatus.FORBIDDEN, message: 'E-mail ainda não verificado' },

  INVALID_AMOUNT: { status: HttpStatus.BAD_REQUEST, message: 'Valor monetário inválido' },
  USER_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Usuário não encontrado' },
  ACCOUNT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Conta não encontrada' },
  CREDIT_CARD_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Cartão não encontrado' },
  INVOICE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Fatura não encontrada' },
  CATEGORY_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Categoria não encontrada' },
  TAG_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Tag não encontrada' },
  TRANSACTION_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Lançamento não encontrado' },
  RECURRING_TRANSACTION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Recorrência não encontrada',
  },
  BUDGET_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Orçamento não encontrado' },
  GOAL_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Meta não encontrada' },
  INVESTMENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Investimento não encontrado' },
  ASSET_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Bem não encontrado' },
  LIABILITY_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Dívida não encontrada' },
  NOTIFICATION_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Notificação não encontrada' },
  SESSION_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Sessão não encontrada' },
  ACCOUNT_NAME_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe uma conta ativa com esse nome',
  },
  ACCOUNT_IN_USE: {
    status: HttpStatus.CONFLICT,
    message: 'Esta conta possui vínculos e não pode ser excluída. Arquive-a para ocultá-la',
  },
  CATEGORY_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe uma categoria com esse nome neste nível',
  },
  CATEGORY_IN_USE: {
    status: HttpStatus.CONFLICT,
    message: 'Categoria em uso. Escolha outra categoria para receber os lançamentos',
  },
  INVALID_PARENT_CATEGORY: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Categoria pai inválida: deve ser sua, do mesmo tipo e de primeiro nível',
  },
  INVALID_FILE_TYPE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Formato de arquivo inválido. Envie uma imagem JPEG, PNG ou WebP',
  },
  FILE_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Arquivo excede o limite de 2 MB',
  },
  CATEGORY_TYPE_MISMATCH: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A categoria não corresponde ao tipo do lançamento',
  },
  ACCOUNT_ARCHIVED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Conta arquivada não pode receber novos lançamentos',
  },
  SAME_ACCOUNT_TRANSFER: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A conta de origem e a de destino devem ser diferentes',
  },
  TAG_ALREADY_EXISTS: { status: HttpStatus.CONFLICT, message: 'Já existe uma tag com esse nome' },
  ONBOARDING_ALREADY_COMPLETED: {
    status: HttpStatus.CONFLICT,
    message: 'O onboarding já foi concluído',
  },
  BUDGET_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um orçamento para esta categoria neste mês',
  },
  BUDGET_OVERLAP: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A categoria principal e suas subcategorias não podem ter orçamentos no mesmo mês',
  },
  GOAL_INSUFFICIENT_BALANCE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'O valor guardado na meta não pode ficar negativo',
  },
  CONTRIBUTION_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Aporte não encontrado' },
  EMERGENCY_FUND_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Reserva de emergência ainda não configurada',
  },
  EMERGENCY_FUND_LINKED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A reserva está vinculada a uma conta: o saldo acompanha a conta automaticamente',
  },
  CARD_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Cartão não encontrado' },
  CARD_NAME_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um cartão ativo com esse nome',
  },
  CARD_IN_USE: {
    status: HttpStatus.CONFLICT,
    message: 'Este cartão possui lançamentos e não pode ser excluído. Arquive-o para ocultá-lo',
  },
  CARD_UNAVAILABLE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Cartão arquivado ou bloqueado não pode receber novas compras',
  },
  PAYMENT_EXCEEDS_INVOICE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'O pagamento excede o valor em aberto da fatura',
  },
  INVESTMENT_INSUFFICIENT: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Quantidade ou valor insuficiente no investimento',
  },
  INVESTMENT_TX_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Movimentação não encontrada' },
  PAYMENT_EXCEEDS_BALANCE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'O pagamento excede o saldo devedor',
  },
  LINKED_TRANSACTION: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Este lançamento foi gerado por um investimento ou pagamento de dívida: altere-o por lá',
  },
};

/** Código padrão quando uma HttpException comum (não AppException) é lançada. */
export function errorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 413:
      return ErrorCode.PAYLOAD_TOO_LARGE;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
  }
}
