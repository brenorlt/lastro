-- CreateEnum
CREATE TYPE "role" AS ENUM ('USER', 'ADMIN');

-- AlterTable: users — sem rota pública para virar ADMIN, só via UPDATE direto no banco.
ALTER TABLE "users" ADD COLUMN "role" "role" NOT NULL DEFAULT 'USER';
