import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { AppRequest } from '../../common/types/http.js';
import { PrismaService } from '../../database/prisma.service.js';

/**
 * Restringe o módulo admin a usuários com `role = ADMIN`. Não existe rota para
 * virar admin — a promoção é manual, direto no banco (UPDATE users SET role='ADMIN').
 * Roda depois do JwtAuthGuard global — precisa de `request.user` já preenchido.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.user) throw new AppException(ErrorCode.UNAUTHORIZED);

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN') throw new AppException(ErrorCode.FORBIDDEN);
    return true;
  }
}
