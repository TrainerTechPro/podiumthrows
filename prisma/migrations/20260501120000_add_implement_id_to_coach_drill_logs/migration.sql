-- AlterTable: CoachDrillLog gains catalog ref. Nullable; coach-side has no
-- backfill script (no historical coach drill data of consequence) — new
-- writes resolve implementId via findCatalogMatchForWeight at insert time.
ALTER TABLE "CoachDrillLog" ADD COLUMN "implementId" TEXT;

-- CreateIndex
CREATE INDEX "CoachDrillLog_implementId_idx" ON "CoachDrillLog"("implementId");

-- AddForeignKey
ALTER TABLE "CoachDrillLog" ADD CONSTRAINT "CoachDrillLog_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
