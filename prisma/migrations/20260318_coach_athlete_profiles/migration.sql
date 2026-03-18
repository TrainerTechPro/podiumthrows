-- AlterTable
ALTER TABLE "AthleteThrowsSession" ADD COLUMN     "loggedByCoach" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CoachProfile" ADD COLUMN     "events" "EventType"[] DEFAULT ARRAY[]::"EventType"[],
ADD COLUMN     "mfaBackupCodes" TEXT[],
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "athleteProfileId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ThrowComment" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "throwLogId" TEXT,
    "practiceAttemptId" TEXT,
    "trainingSessionId" TEXT,
    "throwsAssignmentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThrowComment_throwLogId_createdAt_idx" ON "ThrowComment"("throwLogId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowComment_practiceAttemptId_createdAt_idx" ON "ThrowComment"("practiceAttemptId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowComment_trainingSessionId_createdAt_idx" ON "ThrowComment"("trainingSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowComment_throwsAssignmentId_createdAt_idx" ON "ThrowComment"("throwsAssignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowComment_authorId_idx" ON "ThrowComment"("authorId");

-- CreateIndex
CREATE INDEX "AthleteProfile_coachId_createdAt_idx" ON "AthleteProfile"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowsAssignment_athleteId_createdAt_idx" ON "ThrowsAssignment"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowsBlockLog_createdAt_idx" ON "ThrowsBlockLog"("createdAt");

-- CreateIndex
CREATE INDEX "ThrowsSession_createdAt_idx" ON "ThrowsSession"("createdAt");

-- CreateIndex
CREATE INDEX "ThrowsSession_coachId_createdAt_idx" ON "ThrowsSession"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingProgram_athleteId_status_idx" ON "TrainingProgram"("athleteId", "status");

-- CreateIndex
CREATE INDEX "VoiceNote_createdAt_idx" ON "VoiceNote"("createdAt");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
