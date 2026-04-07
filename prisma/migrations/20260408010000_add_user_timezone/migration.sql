-- AlterTable: add timezone column to CoachProfile
ALTER TABLE "CoachProfile" ADD COLUMN "timezone" TEXT;

-- AlterTable: add timezone column to AthleteProfile
ALTER TABLE "AthleteProfile" ADD COLUMN "timezone" TEXT;
