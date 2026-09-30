-- AlterEnum: billing_payment_method — volta o cartão (avulso e recorrente).
ALTER TYPE "billing_payment_method" ADD VALUE 'CARD';

-- AlterTable: subscriptions — campos da recorrência no cartão.
ALTER TABLE "subscriptions" ADD COLUMN "abacatepay_subscription_id" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_abacatepay_subscription_id_key" ON "subscriptions"("abacatepay_subscription_id");
