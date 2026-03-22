-- AlterTable
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "hrvMs" DOUBLE PRECISION,
ADD COLUMN "restingHR" DOUBLE PRECISION,
ADD COLUMN "spo2" DOUBLE PRECISION,
ADD COLUMN "whoopStrain" DOUBLE PRECISION,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "WhoopConnection" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "whoopUserId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "syncMode" TEXT NOT NULL DEFAULT 'ASSISTED',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhoopDailySnapshot" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "recoveryScore" DOUBLE PRECISION,
    "hrvMs" DOUBLE PRECISION,
    "restingHR" DOUBLE PRECISION,
    "spo2" DOUBLE PRECISION,
    "skinTempC" DOUBLE PRECISION,
    "sleepPerformance" DOUBLE PRECISION,
    "sleepDurationMs" INTEGER,
    "sleepEfficiency" DOUBLE PRECISION,
    "lightSleepMs" INTEGER,
    "swsSleepMs" INTEGER,
    "remSleepMs" INTEGER,
    "strain" DOUBLE PRECISION,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhoopDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhoopConnection_athleteId_key" ON "WhoopConnection"("athleteId");

-- CreateIndex
CREATE INDEX "WhoopConnection_whoopUserId_idx" ON "WhoopConnection"("whoopUserId");

-- CreateIndex
CREATE INDEX "WhoopDailySnapshot_connectionId_date_idx" ON "WhoopDailySnapshot"("connectionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopDailySnapshot_connectionId_date_key" ON "WhoopDailySnapshot"("connectionId", "date");

-- AddForeignKey
ALTER TABLE "WhoopConnection" ADD CONSTRAINT "WhoopConnection_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhoopDailySnapshot" ADD CONSTRAINT "WhoopDailySnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WhoopConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
