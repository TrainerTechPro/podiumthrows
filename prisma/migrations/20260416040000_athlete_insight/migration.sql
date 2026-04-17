-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('TRAINING_PATTERN', 'LIFT_THROW', 'READINESS_COMPETITION');

-- CreateEnum
CREATE TYPE "ConfidenceBand" AS ENUM ('WEAK', 'MEDIUM', 'STRONG');

-- CreateEnum
CREATE TYPE "InsightTrigger" AS ENUM ('MEET_COMPLETE', 'ON_DEMAND', 'CRON');

-- CreateTable
CREATE TABLE "AthleteInsight" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "category" "InsightCategory" NOT NULL,
    "metric" TEXT NOT NULL,
    "event" "EventType",
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "detail" TEXT,
    "confidenceBand" "ConfidenceBand" NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "coefficient" DOUBLE PRECISION,
    "effectSize" DOUBLE PRECISION,
    "effectUnit" TEXT,
    "evidence" JSONB NOT NULL,
    "readByCoachAt" TIMESTAMP(3),
    "readByAthleteAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "triggerKind" "InsightTrigger" NOT NULL,
    "triggerMeetId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteInsight_athleteId_category_computedAt_idx" ON "AthleteInsight"("athleteId", "category", "computedAt");

-- CreateIndex
CREATE INDEX "AthleteInsight_athleteId_computedAt_idx" ON "AthleteInsight"("athleteId", "computedAt");

-- AddForeignKey
ALTER TABLE "AthleteInsight" ADD CONSTRAINT "AthleteInsight_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
