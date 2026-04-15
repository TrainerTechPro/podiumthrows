-- CreateTable
CREATE TABLE "AssessmentOverride" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "assessmentDaysStale" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentOverride_coachId_createdAt_idx" ON "AssessmentOverride"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentOverride_athleteId_createdAt_idx" ON "AssessmentOverride"("athleteId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssessmentOverride" ADD CONSTRAINT "AssessmentOverride_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentOverride" ADD CONSTRAINT "AssessmentOverride_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
