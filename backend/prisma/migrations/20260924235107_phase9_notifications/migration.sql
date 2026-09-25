-- Fase 9: idempotência de notificações (dedupeKey) e resumo semanal.
-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'WEEKLY_SUMMARY';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" VARCHAR(160);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

