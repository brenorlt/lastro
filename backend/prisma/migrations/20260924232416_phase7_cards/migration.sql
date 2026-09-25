-- Nome do cartão case-insensitive preservando dados + unicidade entre cartões ativos.
ALTER TABLE "credit_cards" ALTER COLUMN "name" TYPE CITEXT;

-- CreateIndex
CREATE UNIQUE INDEX "credit_cards_user_active_name_key" ON "credit_cards"("user_id", "name") WHERE (status = 'ACTIVE' AND deleted_at IS NULL);
