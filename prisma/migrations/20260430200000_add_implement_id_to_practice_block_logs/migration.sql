-- AlterTable: PracticeAttempt + ThrowsBlockLog gain catalog refs.
-- Nullable until backfill completes.
ALTER TABLE "PracticeAttempt" ADD COLUMN "implementId" TEXT;
ALTER TABLE "ThrowsBlockLog" ADD COLUMN "implementId" TEXT;

-- CreateIndex
CREATE INDEX "PracticeAttempt_implementId_idx" ON "PracticeAttempt"("implementId");
CREATE INDEX "ThrowsBlockLog_implementId_idx" ON "ThrowsBlockLog"("implementId");

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ThrowsBlockLog" ADD CONSTRAINT "ThrowsBlockLog_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Implement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
