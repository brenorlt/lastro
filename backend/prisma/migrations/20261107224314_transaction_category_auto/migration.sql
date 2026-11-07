-- AlterTable
ALTER TABLE "recurring_transactions" ADD COLUMN     "category_auto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "category_auto" BOOLEAN NOT NULL DEFAULT false;
