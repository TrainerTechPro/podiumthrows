-- CreateTable: LiftingProgram
CREATE TABLE "LiftingProgram" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "name" TEXT NOT NULL,
    "goals" TEXT,
    "workoutsPerWeek" INTEGER NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "rpeTargets" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TEXT,
    "completedDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LiftingProgramPhase
CREATE TABLE "LiftingProgramPhase" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftingProgramPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LiftingProgramExercise
CREATE TABLE "LiftingProgramExercise" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prescribedSets" INTEGER NOT NULL DEFAULT 1,
    "prescribedReps" TEXT,
    "prescribedDuration" TEXT,
    "prescribedLoad" TEXT,
    "isIsometric" BOOLEAN NOT NULL DEFAULT false,
    "durationProgression" TEXT,
    "setsProgression" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftingProgramExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LiftingWorkoutLog
CREATE TABLE "LiftingWorkoutLog" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "phaseId" TEXT,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "weekNumber" INTEGER NOT NULL,
    "workoutNumber" INTEGER NOT NULL,
    "targetRpe" TEXT,
    "actualRpe" DOUBLE PRECISION,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "durationMinutes" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftingWorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LiftingExerciseLog
CREATE TABLE "LiftingExerciseLog" (
    "id" TEXT NOT NULL,
    "workoutLogId" TEXT NOT NULL,
    "programExerciseId" TEXT,
    "exerciseName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "load" DOUBLE PRECISION,
    "loadUnit" TEXT NOT NULL DEFAULT 'lbs',
    "duration" INTEGER,
    "isSkipped" BOOLEAN NOT NULL DEFAULT false,
    "isAdded" BOOLEAN NOT NULL DEFAULT false,
    "isModified" BOOLEAN NOT NULL DEFAULT false,
    "previousLoad" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiftingExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiftingProgram_coachId_idx" ON "LiftingProgram"("coachId");
CREATE INDEX "LiftingProgram_athleteId_idx" ON "LiftingProgram"("athleteId");
CREATE INDEX "LiftingProgram_status_idx" ON "LiftingProgram"("status");

CREATE INDEX "LiftingProgramPhase_programId_idx" ON "LiftingProgramPhase"("programId");
CREATE UNIQUE INDEX "LiftingProgramPhase_programId_order_key" ON "LiftingProgramPhase"("programId", "order");

CREATE INDEX "LiftingProgramExercise_phaseId_idx" ON "LiftingProgramExercise"("phaseId");
CREATE UNIQUE INDEX "LiftingProgramExercise_phaseId_order_key" ON "LiftingProgramExercise"("phaseId", "order");

CREATE INDEX "LiftingWorkoutLog_coachId_date_idx" ON "LiftingWorkoutLog"("coachId", "date");
CREATE INDEX "LiftingWorkoutLog_athleteId_date_idx" ON "LiftingWorkoutLog"("athleteId", "date");
CREATE UNIQUE INDEX "LiftingWorkoutLog_programId_weekNumber_workoutNumber_coachId_key" ON "LiftingWorkoutLog"("programId", "weekNumber", "workoutNumber", "coachId");

CREATE INDEX "LiftingExerciseLog_workoutLogId_order_idx" ON "LiftingExerciseLog"("workoutLogId", "order");
CREATE INDEX "LiftingExerciseLog_exerciseName_createdAt_idx" ON "LiftingExerciseLog"("exerciseName", "createdAt");

-- AddForeignKey
ALTER TABLE "LiftingProgram" ADD CONSTRAINT "LiftingProgram_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiftingProgram" ADD CONSTRAINT "LiftingProgram_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiftingProgramPhase" ADD CONSTRAINT "LiftingProgramPhase_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LiftingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiftingProgramExercise" ADD CONSTRAINT "LiftingProgramExercise_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "LiftingProgramPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiftingWorkoutLog" ADD CONSTRAINT "LiftingWorkoutLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LiftingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiftingWorkoutLog" ADD CONSTRAINT "LiftingWorkoutLog_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "LiftingProgramPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiftingWorkoutLog" ADD CONSTRAINT "LiftingWorkoutLog_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiftingWorkoutLog" ADD CONSTRAINT "LiftingWorkoutLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiftingExerciseLog" ADD CONSTRAINT "LiftingExerciseLog_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "LiftingWorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiftingExerciseLog" ADD CONSTRAINT "LiftingExerciseLog_programExerciseId_fkey" FOREIGN KEY ("programExerciseId") REFERENCES "LiftingProgramExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
