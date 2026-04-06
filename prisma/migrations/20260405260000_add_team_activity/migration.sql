-- CreateTable: TeamActivity — chronological feed scoped to a coach's roster.
CREATE TABLE "TeamActivity" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamActivity_coachId_createdAt_idx" ON "TeamActivity"("coachId", "createdAt");
CREATE INDEX "TeamActivity_athleteId_idx" ON "TeamActivity"("athleteId");
CREATE INDEX "TeamActivity_type_idx" ON "TeamActivity"("type");

ALTER TABLE "TeamActivity" ADD CONSTRAINT "TeamActivity_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamActivity" ADD CONSTRAINT "TeamActivity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: TeamActivityReaction — per-user, per-emoji reactions.
-- Composite unique prevents the same user from double-tapping the same emoji.
CREATE TABLE "TeamActivityReaction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamActivityReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamActivityReaction_activityId_userId_emoji_key" ON "TeamActivityReaction"("activityId", "userId", "emoji");
CREATE INDEX "TeamActivityReaction_activityId_idx" ON "TeamActivityReaction"("activityId");

ALTER TABLE "TeamActivityReaction" ADD CONSTRAINT "TeamActivityReaction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TeamActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
