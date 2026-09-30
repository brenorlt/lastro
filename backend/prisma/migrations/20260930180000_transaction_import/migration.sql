-- AlterTable: transactions — impressão digital da linha do extrato importado.
ALTER TABLE "transactions" ADD COLUMN "external_id" VARCHAR(64);

-- CreateIndex: uma linha de extrato vira no máximo um lançamento ativo por usuário.
CREATE UNIQUE INDEX "transactions_user_external_id_key" ON "transactions"("user_id", "external_id") WHERE (external_id IS NOT NULL AND deleted_at IS NULL);
