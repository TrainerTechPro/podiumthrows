-- AlterTable
ALTER TABLE "AthleteProfile" ADD COLUMN     "isSelfCoached" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CoachProfile" ADD COLUMN     "trainingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventGroup" ALTER COLUMN "events" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeMode" TEXT NOT NULL DEFAULT 'COACH';
