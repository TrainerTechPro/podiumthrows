-- AlterTable
ALTER TABLE "ThrowComment" ADD COLUMN     "athleteDrillLogId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "videoAnalysisId" TEXT;

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "typeOverrides" JSONB NOT NULL DEFAULT '{}',
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "ThrowComment_athleteDrillLogId_createdAt_idx" ON "ThrowComment"("athleteDrillLogId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowComment_videoAnalysisId_createdAt_idx" ON "ThrowComment"("videoAnalysisId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowComment_deletedAt_idx" ON "ThrowComment"("deletedAt");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
