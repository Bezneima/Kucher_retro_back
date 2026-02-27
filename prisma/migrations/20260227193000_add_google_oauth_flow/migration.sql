-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'local',
  ADD COLUMN "googleSub" TEXT,
  ADD COLUMN "googleEmail" TEXT;

-- CreateTable
CREATE TABLE "oauth_states" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "returnTo" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_exchange_tokens" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_exchange_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_stateHash_key" ON "oauth_states"("stateHash");

-- CreateIndex
CREATE INDEX "oauth_states_expiresAt_idx" ON "oauth_states"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_exchange_tokens_tokenHash_key" ON "auth_exchange_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_exchange_tokens_userId_idx" ON "auth_exchange_tokens"("userId");

-- CreateIndex
CREATE INDEX "auth_exchange_tokens_expiresAt_idx" ON "auth_exchange_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "auth_exchange_tokens"
ADD CONSTRAINT "auth_exchange_tokens_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
