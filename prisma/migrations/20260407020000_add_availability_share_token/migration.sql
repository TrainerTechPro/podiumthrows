-- AlterTable: add availabilityShareToken to AthleteProfile
ALTER TABLE "AthleteProfile" ADD COLUMN "availabilityShareToken" TEXT;

-- CreateIndex: unique constraint
CREATE UNIQUE INDEX "AthleteProfile_availabilityShareToken_key" ON "AthleteProfile"("availabilityShareToken");
