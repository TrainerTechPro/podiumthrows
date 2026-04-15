-- Tighten ThrowsBlock.blockType from a loose `TEXT` to a strict enum.
-- All existing string values (WARMUP, THROWING, STRENGTH, PLYOMETRIC,
-- COOLDOWN, NOTES) are preserved verbatim as enum members. Three new
-- semantic categories (MOBILITY, RECOVERY, CONDITIONING) are added for
-- coaches to opt into on future sessions.
--
-- Rollback:
--   ALTER TABLE "ThrowsBlock"
--     ALTER COLUMN "blockType" TYPE TEXT USING "blockType"::TEXT;
--   DROP TYPE "SessionBlockType";

-- CreateEnum
CREATE TYPE "SessionBlockType" AS ENUM (
  'THROWING',
  'STRENGTH',
  'WARMUP',
  'COOLDOWN',
  'PLYOMETRIC',
  'NOTES',
  'MOBILITY',
  'RECOVERY',
  'CONDITIONING'
);

-- AlterTable — cast existing TEXT values into the enum.
-- If any row has a blockType OUTSIDE the declared enum members, this cast
-- will fail and the migration aborts cleanly (no partial state).
ALTER TABLE "ThrowsBlock"
  ALTER COLUMN "blockType" TYPE "SessionBlockType"
  USING "blockType"::"SessionBlockType";
