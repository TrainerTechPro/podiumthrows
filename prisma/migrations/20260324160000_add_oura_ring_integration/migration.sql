-- CreateTable
CREATE TABLE "OuraConnection" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "ouraUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "syncMode" TEXT NOT NULL DEFAULT 'ASSISTED',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OuraConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OuraDailySnapshot" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "readinessScore" DOUBLE PRECISION,
    "hrvMs" DOUBLE PRECISION,
    "restingHR" DOUBLE PRECISION,
    "spo2" DOUBLE PRECISION,
    "temperatureDeviation" DOUBLE PRECISION,
    "sleepScore" DOUBLE PRECISION,
    "sleepDurationSec" INTEGER,
    "sleepEfficiency" DOUBLE PRECISION,
    "lightSleepSec" INTEGER,
    "deepSleepSec" INTEGER,
    "remSleepSec" INTEGER,
    "activityScore" DOUBLE PRECISION,
    "steps" INTEGER,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OuraDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "ouraActivityScore" DOUBLE PRECISION;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "ouraReadiness" DOUBLE PRECISION;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "temperatureDeviation" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "OuraConnection_athleteId_key" ON "OuraConnection"("athleteId");

-- CreateIndex
CREATE INDEX "OuraConnection_ouraUserId_idx" ON "OuraConnection"("ouraUserId");

-- CreateIndex
CREATE INDEX "OuraDailySnapshot_connectionId_date_idx" ON "OuraDailySnapshot"("connectionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OuraDailySnapshot_connectionId_date_key" ON "OuraDailySnapshot"("connectionId", "date");

-- AddForeignKey
ALTER TABLE "OuraConnection" ADD CONSTRAINT "OuraConnection_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OuraDailySnapshot" ADD CONSTRAINT "OuraDailySnapshot_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OuraConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
