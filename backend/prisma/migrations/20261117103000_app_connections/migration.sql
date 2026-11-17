-- CreateEnum
CREATE TYPE "app_token_kind" AS ENUM ('ACCESS', 'REFRESH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "security_event_type" ADD VALUE 'APP_CONNECTED';
ALTER TYPE "security_event_type" ADD VALUE 'APP_DISCONNECTED';

-- CreateTable
CREATE TABLE "app_clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "redirect_uris" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_authorization_codes" (
    "id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" VARCHAR(128) NOT NULL,
    "scope" VARCHAR(255) NOT NULL,
    "resource" VARCHAR(512),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "scope" VARCHAR(255) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_tokens" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "kind" "app_token_kind" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_authorization_codes_code_hash_key" ON "app_authorization_codes"("code_hash");

-- CreateIndex
CREATE INDEX "app_authorization_codes_expires_at_idx" ON "app_authorization_codes"("expires_at");

-- CreateIndex
CREATE INDEX "app_connections_user_id_revoked_at_idx" ON "app_connections"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_tokens_token_hash_key" ON "app_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "app_tokens_connection_id_idx" ON "app_tokens"("connection_id");

-- CreateIndex
CREATE INDEX "app_tokens_expires_at_idx" ON "app_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "app_authorization_codes" ADD CONSTRAINT "app_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "app_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_authorization_codes" ADD CONSTRAINT "app_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_connections" ADD CONSTRAINT "app_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_connections" ADD CONSTRAINT "app_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "app_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_tokens" ADD CONSTRAINT "app_tokens_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "app_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
