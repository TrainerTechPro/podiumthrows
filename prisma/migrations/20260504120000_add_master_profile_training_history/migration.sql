-- Master Profile — Training History (athlete-managed JSON column).
-- Phase A of athlete-master-profile-plan-v2: closes the gap on training
-- background (years training, weekly volume, prior coaches, notable
-- competitions, pre-app PRs per event). JSONB so the shape can evolve
-- behind a `version` discriminator without a migration.

ALTER TABLE "AthleteProfile" ADD COLUMN "trainingHistory" JSONB;
