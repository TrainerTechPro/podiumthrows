-- Phase A.3 of athlete-master-profile-plan-v2 — lifestyle section.
-- Captures sleep, school/work load, baseline stress, nutrition setup, and
-- recovery practices. Sensitive data — coach reads remain gated by the
-- existing requireCoachAthlete relationship check.
--
-- JSONB so the recoveryPractices vocabulary can grow without a migration.

ALTER TABLE "AthleteProfile" ADD COLUMN "lifestyle" JSONB;
