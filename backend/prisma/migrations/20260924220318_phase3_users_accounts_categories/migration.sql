-- Nomes de contas e categorias passam a ser citext (comparação case-insensitive),
-- preservando os dados existentes (ALTER TYPE em vez de DROP/ADD).
ALTER TABLE "accounts" ALTER COLUMN "name" TYPE CITEXT;
ALTER TABLE "categories" ALTER COLUMN "name" TYPE CITEXT;

-- O UNIQUE antigo não cobria parent_id NULL e bloqueava recriar categorias excluídas (soft delete).
DROP INDEX "categories_user_id_parent_id_name_type_key";

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_active_name_key" ON "accounts"("user_id", "name") WHERE (status = 'ACTIVE' AND deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "categories_root_name_key" ON "categories"("user_id", "type", "name") WHERE (parent_id IS NULL AND deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "categories_child_name_key" ON "categories"("user_id", "parent_id", "name") WHERE (parent_id IS NOT NULL AND deleted_at IS NULL);
