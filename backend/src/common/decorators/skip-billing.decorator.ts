import { SetMetadata } from '@nestjs/common';

export const IS_SKIP_BILLING_KEY = 'isSkipBilling';

/** Libera a rota do SubscriptionGuard global mesmo com a assinatura bloqueada. */
export const SkipBilling = () => SetMetadata(IS_SKIP_BILLING_KEY, true);
