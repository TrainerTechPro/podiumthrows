-- Per-data-type display unit preferences. Persists user's metric/imperial
-- choice independently for distance, bodyWeight, liftingWeight, height.
--
-- Stored as JSONB so the shape can evolve without a migration. Null = all
-- metric (default); missing keys also default to metric in the read path.
--
-- Implement weights are intentionally NOT included — those render via the
-- per-row primaryUnit on the Implement catalog (see custom-implements PR).

ALTER TABLE "AthleteProfile" ADD COLUMN "displayUnits" JSONB;
ALTER TABLE "CoachProfile"   ADD COLUMN "displayUnits" JSONB;
