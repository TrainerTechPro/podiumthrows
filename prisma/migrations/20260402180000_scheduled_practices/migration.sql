-- CreateTable
CREATE TABLE "ScheduledPractice" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "groupId" TEXT,
    "recurringId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPractice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPracticeAttendance" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "markedBy" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ScheduledPracticeAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPractice_coachId_date_idx" ON "ScheduledPractice"("coachId", "date");

-- CreateIndex
CREATE INDEX "ScheduledPractice_recurringId_idx" ON "ScheduledPractice"("recurringId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledPracticeAttendance_practiceId_athleteId_key" ON "ScheduledPracticeAttendance"("practiceId", "athleteId");

-- CreateIndex
CREATE INDEX "ScheduledPracticeAttendance_athleteId_markedAt_idx" ON "ScheduledPracticeAttendance"("athleteId", "markedAt");

-- AddForeignKey
ALTER TABLE "ScheduledPractice" ADD CONSTRAINT "ScheduledPractice_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPractice" ADD CONSTRAINT "ScheduledPractice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPracticeAttendance" ADD CONSTRAINT "ScheduledPracticeAttendance_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "ScheduledPractice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPracticeAttendance" ADD CONSTRAINT "ScheduledPracticeAttendance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
