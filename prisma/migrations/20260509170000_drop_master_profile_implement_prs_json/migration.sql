-- Phase B.2 of athlete-master-profile-plan-v2 — second reconciliation.
--
-- Drops the legacy `implementPRs` JSON column from AthleteProfile. The
-- catalog-keyed AthleteImplementPR table (shipped 2026-05-01 with the
-- implement catalog) is now the single source of truth for per-implement
-- PRs. Survey of src/ on 2026-05-09: zero readers of implementPRs (only
-- the api-schemas Zod field + the coach profile route's pass-through
-- write plumbing exist), no UI surface, no reports/exports.
--
-- The sibling `competitionPRs` column stays for now — its legacy-meet-
-- result-promotion flow (POST /api/throws/competitions/[id]/promote-legacy)
-- still actively reads + writes it. Migrating that flow onto
-- AthleteImplementPR.bestCompDistance is a separate, larger PR.
--
-- Defensive guard: same pattern as B.1's injuryHistory drop. If any row
-- carries implementPRs data, the migration aborts and the deploy fails
-- loudly. A failure here means a row exists that needs to be hand-
-- migrated to AthleteImplementPR before retrying.

DO $$
DECLARE
  populated_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO populated_rows
  FROM "AthleteProfile"
  WHERE "implementPRs" IS NOT NULL;

  IF populated_rows > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop AthleteProfile.implementPRs: % row(s) still carry data. Hand-migrate to AthleteImplementPR before retrying.',
      populated_rows;
  END IF;
END $$;

ALTER TABLE "AthleteProfile" DROP COLUMN "implementPRs";
