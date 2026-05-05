-- Phase D of athlete-master-profile-plan-v2 — completion timestamp.
-- Stamped once when the athlete-writable Master Profile sections all carry
-- values. Drives the /athlete/dashboard nudge banner and a coach-side
-- completion indicator. Backfill stays NULL — existing rows surface the
-- nudge until the athlete touches their profile.

ALTER TABLE "AthleteProfile" ADD COLUMN "masterProfileCompletedAt" TIMESTAMP(3);
