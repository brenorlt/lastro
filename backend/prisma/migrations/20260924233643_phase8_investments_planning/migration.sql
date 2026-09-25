-- Fase 8: posição de investimentos derivada de transações, vínculo com caixa, pagamentos de dívidas e premissas de planejamento.
-- AlterTable
ALTER TABLE "investment_transactions" ADD COLUMN     "account_id" UUID,
ADD COLUMN     "transaction_id" UUID;

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "income" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "last_valuation_at" DATE,
ADD COLUMN     "realized_gain" DECIMAL(18,2) NOT NULL DEFAULT 0,
ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "quantity" DROP DEFAULT,
ALTER COLUMN "average_price" DROP NOT NULL,
ALTER COLUMN "average_price" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "planning_assumptions" JSONB;

-- CreateTable
CREATE TABLE "liability_payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "liability_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL,
    "account_id" UUID,
    "transaction_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "liability_payments_transaction_id_key" ON "liability_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "liability_payments_liability_id_date_idx" ON "liability_payments"("liability_id", "date");

-- CreateIndex
CREATE INDEX "liability_payments_user_id_idx" ON "liability_payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "investment_transactions_transaction_id_key" ON "investment_transactions"("transaction_id");

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability_payments" ADD CONSTRAINT "liability_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability_payments" ADD CONSTRAINT "liability_payments_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability_payments" ADD CONSTRAINT "liability_payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability_payments" ADD CONSTRAINT "liability_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

