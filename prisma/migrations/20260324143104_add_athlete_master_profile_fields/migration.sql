-- AlterTable
ALTER TABLE "AthleteProfile" ADD COLUMN     "classStanding" TEXT,
ADD COLUMN     "competitionGoals" JSONB,
ADD COLUMN     "gradYear" INTEGER,
ADD COLUMN     "movementRestrictions" JSONB,
ADD COLUMN     "strengthNumbers" JSONB,
ADD COLUMN     "technicalProfile" JSONB,
ADD COLUMN     "turnDirection" TEXT;
