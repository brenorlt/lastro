-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lockout_count" INTEGER NOT NULL DEFAULT 0;
