-- Alter retro column color format from plain text to JSON object
ALTER TABLE "retro_columns"
ALTER COLUMN "color" TYPE JSONB
USING jsonb_build_object(
  'columnColor', "color",
  'itemColor', "color",
  'buttonColor', "color"
);
