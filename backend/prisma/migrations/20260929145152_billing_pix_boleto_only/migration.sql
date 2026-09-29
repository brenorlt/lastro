-- AlterEnum: billing_payment_method (drop CARD, add BOLETO)
-- Postgres can't drop/add enum values in place while a column still uses the type,
-- so this follows Prisma's standard pattern: new type, migrate the column, swap names.
BEGIN;
CREATE TYPE "billing_payment_method_new" AS ENUM ('PIX', 'BOLETO');
ALTER TABLE "payments" ALTER COLUMN "method" TYPE "billing_payment_method_new" USING ("method"::text::"billing_payment_method_new");
ALTER TYPE "billing_payment_method" RENAME TO "billing_payment_method_old";
ALTER TYPE "billing_payment_method_new" RENAME TO "billing_payment_method";
DROP TYPE "billing_payment_method_old";
COMMIT;

-- AlterTable: subscriptions — remove campos exclusivos de recorrência no cartão.
ALTER TABLE "subscriptions" DROP COLUMN "cancel_at_period_end";
ALTER TABLE "subscriptions" DROP COLUMN "abacatepay_subscription_id";

-- AlterTable: payments — linha digitável do boleto.
ALTER TABLE "payments" ADD COLUMN "bar_code" TEXT;
