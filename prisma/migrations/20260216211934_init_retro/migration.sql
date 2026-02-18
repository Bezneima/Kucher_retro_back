-- CreateTable
CREATE TABLE "retro_boards" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_columns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "boardId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_items" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "likes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "rowIndex" INTEGER NOT NULL,
    "columnId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retro_columns_boardId_orderIndex_idx" ON "retro_columns"("boardId", "orderIndex");

-- CreateIndex
CREATE INDEX "retro_items_columnId_rowIndex_idx" ON "retro_items"("columnId", "rowIndex");

-- AddForeignKey
ALTER TABLE "retro_columns" ADD CONSTRAINT "retro_columns_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "retro_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_items" ADD CONSTRAINT "retro_items_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "retro_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
