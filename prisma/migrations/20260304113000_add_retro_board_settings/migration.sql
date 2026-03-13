ALTER TABLE "retro_boards"
ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{"showLikes": true}'::jsonb;
