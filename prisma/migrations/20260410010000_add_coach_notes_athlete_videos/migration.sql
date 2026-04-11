-- CreateEnum
CREATE TYPE "NoteCategory" AS ENUM ('TECHNICAL', 'MENTAL', 'INJURY', 'GENERAL');

-- CreateTable
CREATE TABLE "CoachNote" (
    "id" TEXT NOT NULL,
    "coachProfileId" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "NoteCategory" NOT NULL DEFAULT 'GENERAL',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteVideo" (
    "id" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "r2Key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "event" "EventType",
    "implementWeight" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachNote_athleteProfileId_idx" ON "CoachNote"("athleteProfileId");

-- CreateIndex
CREATE INDEX "CoachNote_coachProfileId_idx" ON "CoachNote"("coachProfileId");

-- CreateIndex
CREATE INDEX "CoachNote_athleteProfileId_createdAt_idx" ON "CoachNote"("athleteProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AthleteVideo_athleteProfileId_idx" ON "AthleteVideo"("athleteProfileId");

-- CreateIndex
CREATE INDEX "AthleteVideo_athleteProfileId_createdAt_idx" ON "AthleteVideo"("athleteProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteVideo" ADD CONSTRAINT "AthleteVideo_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteVideo" ADD CONSTRAINT "AthleteVideo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
