import type { Request } from 'express';
import type { AuthUser } from './auth-user.js';
import type { ErrorDetail } from '../errors/app.exception.js';
import type { ErrorCode } from '../errors/error-codes.js';

export const REQUEST_ID_HEADER = 'x-request-id';

export type AppRequest = Request & { user?: AuthUser };

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SuccessResponse<T, M = PaginationMeta> {
  success: true;
  data: T;
  meta?: M;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code: ErrorCode;
  statusCode: number;
  details?: ErrorDetail[];
  path: string;
  timestamp: string;
  requestId: string;
}
