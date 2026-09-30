-- CreateEnum
CREATE TYPE "oauth_provider" AS ENUM ('GOOGLE');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "oauth_provider" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" CITEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_provider_user_id_key" ON "oauth_identities"("provider", "provider_user_id");

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
