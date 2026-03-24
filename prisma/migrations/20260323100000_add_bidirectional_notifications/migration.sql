-- AlterTable: make coachId optional (was required)
ALTER TABLE "Notification" ALTER COLUMN "coachId" DROP NOT NULL;

-- AddColumn: athleteProfileId for athlete-targeted notifications
ALTER TABLE "Notification" ADD COLUMN "athleteProfileId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Notification_athleteProfileId_read_idx" ON "Notification"("athleteProfileId", "read");

-- CreateIndex
CREATE INDEX "Notification_athleteProfileId_createdAt_idx" ON "Notification"("athleteProfileId", "createdAt");
