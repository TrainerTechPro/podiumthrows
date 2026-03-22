-- CreateEnum
CREATE TYPE "ProgramSource" AS ENUM ('COACH_PRESCRIBED', 'COACH_SELF_TRAINING', 'ATHLETE_SELF_GENERATED');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "athleteProfileId" TEXT;

-- AlterTable
ALTER TABLE "TrainingProgram" ADD COLUMN     "source" "ProgramSource" NOT NULL DEFAULT 'COACH_PRESCRIBED';

-- CreateTable
CREATE TABLE "SelfProgramConfig" (
    "id" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "trainingProgramId" TEXT,
    "programType" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "competitionLevel" TEXT NOT NULL,
    "currentPR" DOUBLE PRECISION NOT NULL,
    "goalDistance" DOUBLE PRECISION NOT NULL,
    "currentWeeklyVolume" INTEGER,
    "availableImplements" JSONB NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "sessionsPerDay" INTEGER NOT NULL,
    "preferredDays" JSONB NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "competitionDates" JSONB,
    "primaryGoal" TEXT NOT NULL,
    "generationMode" TEXT NOT NULL,
    "exercisePreferences" JSONB,
    "usedExistingTyping" BOOLEAN NOT NULL DEFAULT false,
    "inlineTypingData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "currentPhaseIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfProgramConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SelfProgramConfig_trainingProgramId_key" ON "SelfProgramConfig"("trainingProgramId");

-- CreateIndex
CREATE INDEX "SelfProgramConfig_athleteProfileId_isActive_idx" ON "SelfProgramConfig"("athleteProfileId", "isActive");

-- CreateIndex
CREATE INDEX "Exercise_athleteProfileId_idx" ON "Exercise"("athleteProfileId");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfProgramConfig" ADD CONSTRAINT "SelfProgramConfig_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfProgramConfig" ADD CONSTRAINT "SelfProgramConfig_trainingProgramId_fkey" FOREIGN KEY ("trainingProgramId") REFERENCES "TrainingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: map existing isCoachSelfProgram to ProgramSource
UPDATE "TrainingProgram" SET "source" = 'COACH_SELF_TRAINING' WHERE "isCoachSelfProgram" = true;
