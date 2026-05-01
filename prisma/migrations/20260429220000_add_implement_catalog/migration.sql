-- CreateEnum
CREATE TYPE "ImplementType" AS ENUM ('HAMMER', 'SHOT', 'DISCUS', 'JAVELIN');

-- CreateEnum
CREATE TYPE "ImplementCategory" AS ENUM ('MEN_SENIOR', 'WOMEN_SENIOR', 'MEN_U20', 'WOMEN_U20', 'HS_BOYS', 'HS_GIRLS', 'TRAINING_HEAVY', 'TRAINING_LIGHT');

-- CreateTable
CREATE TABLE "Implement" (
    "id" TEXT NOT NULL,
    "throwType" "ImplementType" NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "weightLb" DOUBLE PRECISION NOT NULL,
    "primaryUnit" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Implement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplementCategoryTag" (
    "id" TEXT NOT NULL,
    "implementId" TEXT NOT NULL,
    "category" "ImplementCategory" NOT NULL,

    CONSTRAINT "ImplementCategoryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteImplementPR" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "implementId" TEXT NOT NULL,
    "bestDistance" DOUBLE PRECISION,
    "bestThrowLogId" TEXT,
    "bestAchievedAt" TIMESTAMP(3),
    "bestContext" TEXT,
    "bestCompDistance" DOUBLE PRECISION,
    "bestCompThrowLogId" TEXT,
    "bestCompAchievedAt" TIMESTAMP(3),
    "throwCountAllTime" INTEGER NOT NULL DEFAULT 0,
    "lastThrownAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteImplementPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowLogBackfillAudit" (
    "id" TEXT NOT NULL,
    "throwLogId" TEXT NOT NULL,
    "beforeWeightKg" DOUBLE PRECISION,
    "beforeUnit" TEXT,
    "beforeOriginal" DOUBLE PRECISION,
    "assignedImplementId" TEXT,
    "deltaKg" DOUBLE PRECISION,
    "kind" TEXT NOT NULL,
    "candidateIds" JSONB,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThrowLogBackfillAudit_pkey" PRIMARY KEY ("id")
);

-- AlterTable: ThrowLog gains catalog ref + recorder/edit attribution.
-- All columns nullable — backfill (Phase C) populates implementId from
-- existing implementWeight/Unit/Original triples; pre-attribution rows stay null.
ALTER TABLE "ThrowLog"
    ADD COLUMN "implementId" TEXT,
    ADD COLUMN "recordedById" TEXT,
    ADD COLUMN "recordedByRole" TEXT,
    ADD COLUMN "lastEditedById" TEXT,
    ADD COLUMN "lastEditedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Implement_throwType_active_sortOrder_idx" ON "Implement"("throwType", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Implement_throwType_weightKg_primaryUnit_key" ON "Implement"("throwType", "weightKg", "primaryUnit");

-- CreateIndex
CREATE INDEX "ImplementCategoryTag_category_idx" ON "ImplementCategoryTag"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ImplementCategoryTag_implementId_category_key" ON "ImplementCategoryTag"("implementId", "category");

-- CreateIndex
CREATE INDEX "AthleteImplementPR_athleteId_lastThrownAt_idx" ON "AthleteImplementPR"("athleteId", "lastThrownAt" DESC);

-- CreateIndex
CREATE INDEX "AthleteImplementPR_implementId_idx" ON "AthleteImplementPR"("implementId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteImplementPR_athleteId_implementId_key" ON "AthleteImplementPR"("athleteId", "implementId");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowLogBackfillAudit_throwLogId_key" ON "ThrowLogBackfillAudit"("throwLogId");

-- CreateIndex
CREATE INDEX "ThrowLogBackfillAudit_kind_idx" ON "ThrowLogBackfillAudit"("kind");

-- CreateIndex
CREATE INDEX "ThrowLogBackfillAudit_runAt_idx" ON "ThrowLogBackfillAudit"("runAt");

-- CreateIndex
CREATE INDEX "ThrowLog_athleteId_implementId_date_idx" ON "ThrowLog"("athleteId", "implementId", "date" DESC);

-- CreateIndex
CREATE INDEX "ThrowLog_athleteId_implementId_distance_idx" ON "ThrowLog"("athleteId", "implementId", "distance" DESC);

-- CreateIndex
CREATE INDEX "ThrowLog_implementId_isPersonalBest_idx" ON "ThrowLog"("implementId", "isPersonalBest");

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementCategoryTag" ADD CONSTRAINT "ImplementCategoryTag_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteImplementPR" ADD CONSTRAINT "AthleteImplementPR_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteImplementPR" ADD CONSTRAINT "AthleteImplementPR_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowLogBackfillAudit" ADD CONSTRAINT "ThrowLogBackfillAudit_assignedImplementId_fkey" FOREIGN KEY ("assignedImplementId") REFERENCES "Implement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
