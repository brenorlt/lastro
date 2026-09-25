-- Recorrências: confirmação automática e cursor de materialização (idempotência do motor).
ALTER TABLE "recurring_transactions" ADD COLUMN "auto_confirm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "last_materialized_date" DATE;

-- Tags: nome case-insensitive preservando dados (ALTER TYPE; o UNIQUE existente passa a valer em citext).
ALTER TABLE "tags" ALTER COLUMN "name" TYPE CITEXT;

-- Busca: texto normalizado mantido pela aplicação + índice trigram.
ALTER TABLE "transactions" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';
UPDATE "transactions" SET "search_text" = lower("description" || ' ' || coalesce("notes", ''));

-- CreateIndex
CREATE INDEX "transactions_search_text_trgm_idx" ON "transactions" USING GIN ("search_text" gin_trgm_ops);
