-- AlterTable: AthleteDrillLog gains catalog ref. Nullable until backfill.
ALTER TABLE "AthleteDrillLog" ADD COLUMN "implementId" TEXT;

-- CreateIndex
CREATE INDEX "AthleteDrillLog_implementId_idx" ON "AthleteDrillLog"("implementId");

-- AddForeignKey
ALTER TABLE "AthleteDrillLog" ADD CONSTRAINT "AthleteDrillLog_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
