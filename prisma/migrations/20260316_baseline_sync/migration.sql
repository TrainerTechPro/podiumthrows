-- DropIndex
DROP INDEX "TrainingProgram_athleteId_status_idx";

-- AlterTable
ALTER TABLE "AdaptationCheckpoint" ADD COLUMN     "feedbackData" TEXT;

-- AlterTable
ALTER TABLE "AthleteThrowsSession" ADD COLUMN     "bestPart" TEXT,
ADD COLUMN     "energyLevel" INTEGER,
ADD COLUMN     "focus" TEXT,
ADD COLUMN     "improvementArea" TEXT,
ADD COLUMN     "mentalFocus" INTEGER,
ADD COLUMN     "sessionFeeling" TEXT,
ADD COLUMN     "sessionRpe" INTEGER,
ADD COLUMN     "sleepQuality" INTEGER,
ADD COLUMN     "sorenessLevel" INTEGER,
ADD COLUMN     "techniqueRating" INTEGER;

-- AlterTable
ALTER TABLE "CoachProfile" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "paymentFailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CodexEntry" ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "TrainingProgram" ADD COLUMN     "competitionCalendar" TEXT,
ADD COLUMN     "isCoachSelfProgram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "longTermGoalDate" TEXT,
ADD COLUMN     "longTermGoalDistance" DOUBLE PRECISION,
ADD COLUMN     "longTermGoalLabel" TEXT,
ADD COLUMN     "mobilityNotes" TEXT,
ADD COLUMN     "shortTermGoalLabel" TEXT,
ALTER COLUMN "athleteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CoachThrowsSession" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "focus" TEXT,
    "notes" TEXT,
    "sleepQuality" INTEGER,
    "sorenessLevel" INTEGER,
    "energyLevel" INTEGER,
    "sessionRpe" INTEGER,
    "sessionFeeling" TEXT,
    "techniqueRating" INTEGER,
    "mentalFocus" INTEGER,
    "bestPart" TEXT,
    "improvementArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachThrowsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachDrillLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "implementWeight" DOUBLE PRECISION,
    "throwCount" INTEGER NOT NULL DEFAULT 0,
    "bestMark" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachDrillLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachPR" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "drillType" TEXT,
    "source" TEXT DEFAULT 'session',

    CONSTRAINT "CoachPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTyping" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "adaptationSpeedResponses" TEXT,
    "transferTypeResponses" TEXT,
    "selfFeelingResponses" TEXT,
    "lightImplResponses" TEXT,
    "recoveryResponses" TEXT,
    "adaptationGroup" INTEGER,
    "adaptationLabel" TEXT,
    "adaptationConf" INTEGER,
    "transferType" TEXT,
    "transferLabel" TEXT,
    "transferConf" INTEGER,
    "selfFeelingAccuracy" TEXT,
    "selfFeelingLabel" TEXT,
    "selfFeelingConf" INTEGER,
    "lightImplResponse" TEXT,
    "lightImplLabel" TEXT,
    "lightImplConf" INTEGER,
    "recoveryProfile" TEXT,
    "recoveryLabel" TEXT,
    "recoveryConf" INTEGER,
    "recommendedMethod" TEXT,
    "methodReason" TEXT,
    "complexDuration" TEXT,
    "sessionsToForm" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachTyping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachTestingRecord" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "testDate" TEXT NOT NULL,
    "event" TEXT,
    "competitionMark" DOUBLE PRECISION,
    "heavyImplMark" DOUBLE PRECISION,
    "heavyImplKg" DOUBLE PRECISION,
    "lightImplMark" DOUBLE PRECISION,
    "lightImplKg" DOUBLE PRECISION,
    "squatKg" DOUBLE PRECISION,
    "benchKg" DOUBLE PRECISION,
    "snatchKg" DOUBLE PRECISION,
    "cleanKg" DOUBLE PRECISION,
    "ohpKg" DOUBLE PRECISION,
    "rdlKg" DOUBLE PRECISION,
    "bodyWeightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachTestingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoregulationSuggestion" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "athleteId" TEXT,
    "checkpointId" TEXT,
    "timescale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suggestedChange" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoApproveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoregulationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramCarryforward" (
    "id" TEXT NOT NULL,
    "completedProgramId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT,
    "previousProgramContext" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramCarryforward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoregulationSettings" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'NOTIFY',
    "timescalesJson" TEXT NOT NULL DEFAULT '{"intraSession":true,"sessionToSession":true,"weekToWeek":true,"blockToBlock":true,"programToProgram":true}',
    "weekToWeek" TEXT NOT NULL DEFAULT 'SUGGEST',
    "blockToBlock" TEXT NOT NULL DEFAULT 'SUGGEST',
    "programToProgram" TEXT NOT NULL DEFAULT 'SUGGEST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoregulationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenBlacklist" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachThrowsSession_coachId_date_idx" ON "CoachThrowsSession"("coachId", "date");

-- CreateIndex
CREATE INDEX "CoachThrowsSession_coachId_event_idx" ON "CoachThrowsSession"("coachId", "event");

-- CreateIndex
CREATE INDEX "CoachDrillLog_sessionId_idx" ON "CoachDrillLog"("sessionId");

-- CreateIndex
CREATE INDEX "CoachPR_coachId_idx" ON "CoachPR"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachPR_coachId_event_implement_key" ON "CoachPR"("coachId", "event", "implement");

-- CreateIndex
CREATE UNIQUE INDEX "CoachTyping_coachId_key" ON "CoachTyping"("coachId");

-- CreateIndex
CREATE INDEX "CoachTestingRecord_coachId_testDate_idx" ON "CoachTestingRecord"("coachId", "testDate");

-- CreateIndex
CREATE INDEX "AutoregulationSuggestion_programId_idx" ON "AutoregulationSuggestion"("programId");

-- CreateIndex
CREATE INDEX "AutoregulationSuggestion_athleteId_idx" ON "AutoregulationSuggestion"("athleteId");

-- CreateIndex
CREATE INDEX "AutoregulationSuggestion_status_autoApproveAt_idx" ON "AutoregulationSuggestion"("status", "autoApproveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCarryforward_completedProgramId_key" ON "ProgramCarryforward"("completedProgramId");

-- CreateIndex
CREATE INDEX "ProgramCarryforward_athleteId_idx" ON "ProgramCarryforward"("athleteId");

-- CreateIndex
CREATE INDEX "ProgramCarryforward_coachId_idx" ON "ProgramCarryforward"("coachId");

-- CreateIndex
CREATE INDEX "AutoregulationSettings_coachId_idx" ON "AutoregulationSettings"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoregulationSettings_coachId_athleteId_key" ON "AutoregulationSettings"("coachId", "athleteId");

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBlacklist_tokenHash_key" ON "TokenBlacklist"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenBlacklist_expiresAt_idx" ON "TokenBlacklist"("expiresAt");

-- CreateIndex
CREATE INDEX "AdaptationCheckpoint_programId_recommendation_applied_idx" ON "AdaptationCheckpoint"("programId", "recommendation", "applied");

-- CreateIndex
CREATE INDEX "AthleteThrowsSession_athleteId_event_idx" ON "AthleteThrowsSession"("athleteId", "event");

-- CreateIndex
CREATE INDEX "PracticeAttempt_athleteId_createdAt_idx" ON "PracticeAttempt"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgramLiftResult_sessionId_createdAt_idx" ON "ProgramLiftResult"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgramSession_programId_status_idx" ON "ProgramSession"("programId", "status");

-- CreateIndex
CREATE INDEX "ProgramSession_programId_phaseId_status_idx" ON "ProgramSession"("programId", "phaseId", "status");

-- CreateIndex
CREATE INDEX "ProgramThrowResult_sessionId_createdAt_idx" ON "ProgramThrowResult"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowAnalysis_coachId_createdAt_idx" ON "ThrowAnalysis"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "ThrowsAssignment_athleteId_status_idx" ON "ThrowsAssignment"("athleteId", "status");

-- CreateIndex
CREATE INDEX "ThrowsBlockLog_assignmentId_blockId_idx" ON "ThrowsBlockLog"("assignmentId", "blockId");

-- CreateIndex
CREATE INDEX "ThrowsDrillPR_athleteId_event_idx" ON "ThrowsDrillPR"("athleteId", "event");

-- CreateIndex
CREATE INDEX "ThrowsProfile_enrolledBy_status_idx" ON "ThrowsProfile"("enrolledBy", "status");

-- CreateIndex
CREATE INDEX "VideoUpload_coachId_createdAt_idx" ON "VideoUpload"("coachId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachThrowsSession" ADD CONSTRAINT "CoachThrowsSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachDrillLog" ADD CONSTRAINT "CoachDrillLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachThrowsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPR" ADD CONSTRAINT "CoachPR_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTyping" ADD CONSTRAINT "CoachTyping_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachTestingRecord" ADD CONSTRAINT "CoachTestingRecord_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

