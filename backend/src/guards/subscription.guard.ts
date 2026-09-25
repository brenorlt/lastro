import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_SKIP_BILLING_KEY } from '../common/decorators/skip-billing.decorator.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { AppRequest } from '../common/types/http.js';
import { PrismaService } from '../database/prisma.service.js';

/**
 * Guard global: bloqueia o acesso quando a assinatura do usuário está `BLOCKED`
 * (trial vencido ou pagamento não renovado). Roda depois do JwtAuthGuard — precisa
 * de `request.user` já preenchido. Rotas com @Public() não têm `request.user` e
 * passam direto; rotas com @SkipBilling() ficam sempre acessíveis (perfil, cobrança).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(IS_SKIP_BILLING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.user) return true;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: request.user.id },
      select: { status: true },
    });
    if (subscription?.status === 'BLOCKED') {
      throw new AppException(ErrorCode.SUBSCRIPTION_REQUIRED);
    }
    return true;
  }
}
