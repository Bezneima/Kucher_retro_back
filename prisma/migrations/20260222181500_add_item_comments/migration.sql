-- CreateTable
CREATE TABLE "retro_item_comments" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "creatorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_item_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retro_item_comments_itemId_createdAt_idx" ON "retro_item_comments"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "retro_item_comments_creatorId_idx" ON "retro_item_comments"("creatorId");

-- AddForeignKey
ALTER TABLE "retro_item_comments" ADD CONSTRAINT "retro_item_comments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "retro_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_item_comments" ADD CONSTRAINT "retro_item_comments_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
