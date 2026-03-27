-- CreateTable
CREATE TABLE "VideoAnalysis" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "fps" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "annotations" JSONB,
    "keyPositions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoAnalysis_athleteId_idx" ON "VideoAnalysis"("athleteId");

-- CreateIndex
CREATE INDEX "VideoAnalysis_coachId_idx" ON "VideoAnalysis"("coachId");

-- CreateIndex
CREATE INDEX "VideoAnalysis_coachId_createdAt_idx" ON "VideoAnalysis"("coachId", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoAnalysis" ADD CONSTRAINT "VideoAnalysis_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysis" ADD CONSTRAINT "VideoAnalysis_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
