/** Contrato de resposta da API NestJS (ResponseInterceptor / AllExceptionsFilter). */

export interface ApiSuccess<T, M = undefined> {
  success: true;
  data: T;
  meta?: M;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  statusCode: number;
  details?: ApiFieldError[];
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
