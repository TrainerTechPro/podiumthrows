-- Custom implements: per-coach catalog rows.
--
-- Adds:
--   ImplementType.WEIGHT_THROW    — covers tires, plates, weighted balls, sledgehammer
--   Implement.notes               — free-form coach context ("3/4 wire", "concrete")
--   Implement.ownerId             — null = global; set = scoped to one coach's roster
--
-- Replaces the 3-column unique with TWO partial unique indexes (rather than
-- a single NULLS NOT DISTINCT unique, since local dev runs Postgres 14):
--   • global rows (ownerId IS NULL)     keep dedupe protection on (type,kg,unit,label)
--   • custom rows (ownerId IS NOT NULL) get scoped uniqueness per coach,
--     with displayLabel in the key so one coach can hold multiple variants
--     ("18 lb · full wire" + "18 lb · 3/4 wire").

ALTER TYPE "ImplementType" ADD VALUE 'WEIGHT_THROW';

ALTER TABLE "Implement"
  ADD COLUMN "notes"   TEXT,
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "Implement"
  ADD CONSTRAINT "Implement_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "CoachProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "Implement_throwType_weightKg_primaryUnit_key";

CREATE UNIQUE INDEX "Implement_global_natural_key"
  ON "Implement" ("throwType", "weightKg", "primaryUnit", "displayLabel")
  WHERE "ownerId" IS NULL;

CREATE UNIQUE INDEX "Implement_owner_natural_key"
  ON "Implement" ("ownerId", "throwType", "weightKg", "primaryUnit", "displayLabel")
  WHERE "ownerId" IS NOT NULL;

CREATE INDEX "Implement_ownerId_idx" ON "Implement" ("ownerId");
