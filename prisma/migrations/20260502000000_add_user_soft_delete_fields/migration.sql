-- AlterTable: User gains soft-delete markers for the 30-day-grace deletion
-- flow (P0-9). Both columns are nullable; null = active account. The
-- hard-delete cron filters on `deleteScheduledFor`, hence the index.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deleteScheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_deleteScheduledFor_idx" ON "User"("deleteScheduledFor");
