-- Phase B of athlete-master-profile-plan-v2 — first reconciliation.
--
-- Drops the legacy `injuryHistory` JSON column from AthleteProfile in
-- favor of the relational `ThrowsInjury` table. The `_tab-injury.tsx`
-- view already reads ThrowsInjury rows, not this JSON; no UI ever writes
-- this column. The Zod schema accepted it but no caller submitted it.
--
-- Defensive guard: if any row carries injuryHistory data, the migration
-- aborts and the deploy fails loudly. This is the prod-data verification
-- gate the plan calls for — a failure here means a row exists that needs
-- to be hand-migrated to ThrowsInjury before retrying.

DO $$
DECLARE
  populated_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO populated_rows
  FROM "AthleteProfile"
  WHERE "injuryHistory" IS NOT NULL;

  IF populated_rows > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop AthleteProfile.injuryHistory: % row(s) still carry data. Hand-migrate to ThrowsInjury before retrying.',
      populated_rows;
  END IF;
END $$;

ALTER TABLE "AthleteProfile" DROP COLUMN "injuryHistory";
