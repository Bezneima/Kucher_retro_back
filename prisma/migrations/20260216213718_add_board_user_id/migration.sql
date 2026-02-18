/*
  Warnings:

  - Added the required column `userId` to the `retro_boards` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "retro_boards" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "retro_boards_userId_idx" ON "retro_boards"("userId");
