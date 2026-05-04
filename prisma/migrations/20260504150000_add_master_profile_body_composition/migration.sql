-- Phase A.4 of athlete-master-profile-plan-v2 — bodyComposition section.
-- Carries body-fat % + tape-measure circumferences only. Power tests
-- (vertical jump, 30m sprint) live in PerformanceTestSession; standing LJ
-- + triple jump live in strengthNumbers.tests; mobility booleans live in
-- movementRestrictions. Owns only what nothing else does.

ALTER TABLE "AthleteProfile" ADD COLUMN "bodyComposition" JSONB;
