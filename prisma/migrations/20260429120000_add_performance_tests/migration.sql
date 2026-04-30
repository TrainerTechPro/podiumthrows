-- CreateTable
CREATE TABLE "PerformanceTestType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "lowerIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "defaultAttempts" INTEGER NOT NULL DEFAULT 3,
    "iconKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceTestType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceTestSession" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "notes" TEXT,
    "conditions" TEXT,
    "peakValue" DOUBLE PRECISION,
    "avgValue" DOUBLE PRECISION,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceTestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceTestAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "lastEditedById" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceTestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceTestType_key_key" ON "PerformanceTestType"("key");

-- CreateIndex
CREATE INDEX "PerformanceTestSession_athleteId_testTypeId_performedAt_idx" ON "PerformanceTestSession"("athleteId", "testTypeId", "performedAt" DESC);

-- CreateIndex
CREATE INDEX "PerformanceTestSession_athleteId_performedAt_idx" ON "PerformanceTestSession"("athleteId", "performedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceTestAttempt_sessionId_attemptNumber_key" ON "PerformanceTestAttempt"("sessionId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "PerformanceTestSession" ADD CONSTRAINT "PerformanceTestSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceTestSession" ADD CONSTRAINT "PerformanceTestSession_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "PerformanceTestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceTestSession" ADD CONSTRAINT "PerformanceTestSession_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceTestAttempt" ADD CONSTRAINT "PerformanceTestAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PerformanceTestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
