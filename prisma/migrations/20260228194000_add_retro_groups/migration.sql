-- Create groups table inside columns.
CREATE TABLE "retro_groups" (
    "id" SERIAL NOT NULL,
    "columnId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" JSONB NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retro_groups_pkey" PRIMARY KEY ("id")
);

-- Add optional group relation to items.
ALTER TABLE "retro_items"
ADD COLUMN "groupId" INTEGER;

-- Replace old index to support row order per container (group or ungrouped).
DROP INDEX IF EXISTS "retro_items_columnId_rowIndex_idx";
CREATE INDEX "retro_items_columnId_groupId_rowIndex_idx" ON "retro_items"("columnId", "groupId", "rowIndex");
CREATE INDEX "retro_groups_columnId_orderIndex_idx" ON "retro_groups"("columnId", "orderIndex");

ALTER TABLE "retro_groups"
ADD CONSTRAINT "retro_groups_columnId_fkey"
FOREIGN KEY ("columnId") REFERENCES "retro_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retro_items"
ADD CONSTRAINT "retro_items_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "retro_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
