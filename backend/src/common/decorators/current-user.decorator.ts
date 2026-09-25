import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';
import type { AuthUser } from '../types/auth-user.js';
import type { AppRequest } from '../types/http.js';

/**
 * Injeta o usuário autenticado (ou uma de suas propriedades).
 * @example handler(@CurrentUser() user: AuthUser, @CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AppRequest>();
    const user = request.user;
    if (!user) throw new AppException(ErrorCode.UNAUTHORIZED);
    return property ? user[property] : user;
  },
);
