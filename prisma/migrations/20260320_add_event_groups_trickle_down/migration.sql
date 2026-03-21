-- ============================================================================
-- Migration: Rename Team → EventGroup, TeamMember → EventGroupMember
-- Add new fields (events, color, order) + ProgrammedSession model
-- Uses RENAME to preserve existing data
-- ============================================================================

-- 1. Rename Team → EventGroup
ALTER TABLE "Team" RENAME TO "EventGroup";

-- 2. Add new columns to EventGroup
ALTER TABLE "EventGroup" ADD COLUMN "events" "EventType"[] DEFAULT ARRAY[]::"EventType"[];
ALTER TABLE "EventGroup" ADD COLUMN "color" TEXT;
ALTER TABLE "EventGroup" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- 3. Rename TeamMember → EventGroupMember
ALTER TABLE "TeamMember" RENAME TO "EventGroupMember";

-- 4. Rename teamId column → groupId in EventGroupMember
ALTER TABLE "EventGroupMember" RENAME COLUMN "teamId" TO "groupId";

-- 5. Rename RecurringSchedule.teamIds → groupIds
ALTER TABLE "RecurringSchedule" RENAME COLUMN "teamIds" TO "groupIds";

-- 6. Rename indexes for EventGroup (was Team)
ALTER INDEX "Team_pkey" RENAME TO "EventGroup_pkey";
ALTER INDEX "Team_coachId_idx" RENAME TO "EventGroup_coachId_idx";

-- 7. Rename indexes for EventGroupMember (was TeamMember)
ALTER INDEX "TeamMember_pkey" RENAME TO "EventGroupMember_pkey";
ALTER INDEX "TeamMember_teamId_athleteId_key" RENAME TO "EventGroupMember_groupId_athleteId_key";
ALTER INDEX "TeamMember_teamId_idx" RENAME TO "EventGroupMember_groupId_idx";
ALTER INDEX "TeamMember_athleteId_idx" RENAME TO "EventGroupMember_athleteId_idx";

-- 8. Rename foreign key constraints
ALTER TABLE "EventGroup" RENAME CONSTRAINT "Team_coachId_fkey" TO "EventGroup_coachId_fkey";
ALTER TABLE "EventGroupMember" RENAME CONSTRAINT "TeamMember_teamId_fkey" TO "EventGroupMember_groupId_fkey";
ALTER TABLE "EventGroupMember" RENAME CONSTRAINT "TeamMember_athleteId_fkey" TO "EventGroupMember_athleteId_fkey";

-- 9. Create ProgrammedSession table
CREATE TABLE "ProgrammedSession" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledDate" TEXT NOT NULL,
    "notes" TEXT,
    "throwsSessionId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "groupId" TEXT,
    "athleteId" TEXT,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammedSession_pkey" PRIMARY KEY ("id")
);

-- 10. Add programmedSessionId to ThrowsAssignment
ALTER TABLE "ThrowsAssignment" ADD COLUMN "programmedSessionId" TEXT;

-- 11. Create indexes for ProgrammedSession
CREATE INDEX "ProgrammedSession_coachId_scheduledDate_idx" ON "ProgrammedSession"("coachId", "scheduledDate");
CREATE INDEX "ProgrammedSession_groupId_idx" ON "ProgrammedSession"("groupId");
CREATE INDEX "ProgrammedSession_athleteId_idx" ON "ProgrammedSession"("athleteId");
CREATE INDEX "ProgrammedSession_parentId_idx" ON "ProgrammedSession"("parentId");
CREATE INDEX "ProgrammedSession_tier_idx" ON "ProgrammedSession"("tier");

-- 12. Create index for ThrowsAssignment.programmedSessionId
CREATE INDEX "ThrowsAssignment_programmedSessionId_idx" ON "ThrowsAssignment"("programmedSessionId");

-- 13. Add foreign keys for ProgrammedSession
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_throwsSessionId_fkey" FOREIGN KEY ("throwsSessionId") REFERENCES "ThrowsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgrammedSession" ADD CONSTRAINT "ProgrammedSession_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProgrammedSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 14. Add foreign key for ThrowsAssignment.programmedSessionId
ALTER TABLE "ThrowsAssignment" ADD CONSTRAINT "ThrowsAssignment_programmedSessionId_fkey" FOREIGN KEY ("programmedSessionId") REFERENCES "ProgrammedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
