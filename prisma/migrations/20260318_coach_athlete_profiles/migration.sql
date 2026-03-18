-- AlterTable: AthleteThrowsSession
ALTER TABLE "AthleteThrowsSession" ADD COLUMN IF NOT EXISTS "loggedByCoach" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: CoachProfile
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "events" "EventType"[] DEFAULT ARRAY[]::"EventType"[];
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "mfaBackupCodes" TEXT[];
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT;

-- AlterTable: Invitation
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "athleteProfileId" TEXT;

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable: ThrowComment
CREATE TABLE IF NOT EXISTS "ThrowComment" (
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

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "ThrowComment_throwLogId_createdAt_idx" ON "ThrowComment"("throwLogId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrowComment_practiceAttemptId_createdAt_idx" ON "ThrowComment"("practiceAttemptId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrowComment_trainingSessionId_createdAt_idx" ON "ThrowComment"("trainingSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrowComment_throwsAssignmentId_createdAt_idx" ON "ThrowComment"("throwsAssignmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrowComment_authorId_idx" ON "ThrowComment"("authorId");
CREATE INDEX IF NOT EXISTS "AthleteProfile_coachId_createdAt_idx" ON "AthleteProfile"("coachId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrowsAssignment_athleteId_createdAt_idx" ON "ThrowsAssignment"("athleteId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrowsBlockLog_createdAt_idx" ON "ThrowsBlockLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ThrowsSession_createdAt_idx" ON "ThrowsSession"("createdAt");
CREATE INDEX IF NOT EXISTS "ThrowsSession_coachId_createdAt_idx" ON "ThrowsSession"("coachId", "createdAt");
CREATE INDEX IF NOT EXISTS "TrainingProgram_athleteId_status_idx" ON "TrainingProgram"("athleteId", "status");
CREATE INDEX IF NOT EXISTS "VoiceNote_createdAt_idx" ON "VoiceNote"("createdAt");

-- AddForeignKey (idempotent: check if constraint exists before adding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_athleteProfileId_fkey'
  ) THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_athleteProfileId_fkey"
      FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
