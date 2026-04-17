-- CreateEnum
CREATE TYPE "MeetStatus" AS ENUM ('COMPLETED', 'DNS', 'DNF', 'DQ');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('INDOOR', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "CompFormat" AS ENUM ('THREE_PLUS_THREE', 'FOUR_STRAIGHT');

-- CreateEnum
CREATE TYPE "ThrowRound" AS ENUM ('PRELIM', 'FINALS');

-- CreateEnum
CREATE TYPE "FoulType" AS ENUM ('RING', 'SECTOR');

-- AlterTable: extend ThrowsCompetition with per-meet context columns
ALTER TABLE "ThrowsCompetition"
  ADD COLUMN "implementWeightKg" DOUBLE PRECISION,
  ADD COLUMN "placeFinish" INTEGER,
  ADD COLUMN "meetStatus" "MeetStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "venueType" "VenueType",
  ADD COLUMN "weather" TEXT,
  ADD COLUMN "windMps" DOUBLE PRECISION,
  ADD COLUMN "format" "CompFormat" DEFAULT 'THREE_PLUS_THREE',
  ADD COLUMN "madeFinals" BOOLEAN;

-- AlterTable: extend ThrowLog with per-throw competition linkage
ALTER TABLE "ThrowLog"
  ADD COLUMN "competitionId" TEXT,
  ADD COLUMN "round" "ThrowRound",
  ADD COLUMN "attemptInRound" INTEGER,
  ADD COLUMN "isFoul" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "foulType" "FoulType",
  ADD COLUMN "isPass" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ThrowLog_competitionId_idx" ON "ThrowLog"("competitionId");

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "ThrowsCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
