-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'POSE_COMPLETE', 'METRICS_COMPLETE', 'COMPLETE', 'FAILED', 'LOW_CONFIDENCE');

-- CreateTable
CREATE TABLE "calibration_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "athleteId" TEXT,
    "event" "EventType" NOT NULL,
    "ringEllipse" JSONB NOT NULL,
    "deviceOrientation" JSONB,
    "homography" JSONB,
    "calibrationStillPath" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibration_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "calibrationSessionId" TEXT,
    "clipPath" TEXT NOT NULL,
    "fpsDeclared" DOUBLE PRECISION,
    "fpsTrue" DOUBLE PRECISION,
    "status" "AnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" JSONB,
    "timings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pose_artifacts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rawPath" TEXT NOT NULL,
    "smoothedPath" TEXT,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "meanQuality" DOUBLE PRECISION,
    "perFrameQualityPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pose_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "phaseBoundaries" JSONB NOT NULL,
    "phaseScores" JSONB,
    "faults" JSONB,
    "narrative" JSONB,
    "keyframePaths" JSONB,
    "reportPdfPath" TEXT,
    "rubricVersion" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "golden_set_clips" (
    "id" TEXT NOT NULL,
    "clipPath" TEXT NOT NULL,
    "event" "EventType" NOT NULL,
    "labels" JSONB,
    "difficulty" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "golden_set_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calibration_sessions_userId_idx" ON "calibration_sessions"("userId");

-- CreateIndex
CREATE INDEX "calibration_sessions_athleteId_idx" ON "calibration_sessions"("athleteId");

-- CreateIndex
CREATE INDEX "calibration_sessions_userId_createdAt_idx" ON "calibration_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "analysis_jobs_userId_idx" ON "analysis_jobs"("userId");

-- CreateIndex
CREATE INDEX "analysis_jobs_athleteId_idx" ON "analysis_jobs"("athleteId");

-- CreateIndex
CREATE INDEX "analysis_jobs_status_idx" ON "analysis_jobs"("status");

-- CreateIndex
CREATE INDEX "analysis_jobs_userId_createdAt_idx" ON "analysis_jobs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pose_artifacts_jobId_key" ON "pose_artifacts"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_jobId_key" ON "analysis_results"("jobId");

-- CreateIndex
CREATE INDEX "golden_set_clips_event_idx" ON "golden_set_clips"("event");

-- AddForeignKey
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_calibrationSessionId_fkey" FOREIGN KEY ("calibrationSessionId") REFERENCES "calibration_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pose_artifacts" ADD CONSTRAINT "pose_artifacts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

