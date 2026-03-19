-- AlterTable
ALTER TABLE "AthleteDrillLog" ADD COLUMN     "wireLength" TEXT;

-- AlterTable
ALTER TABLE "CoachDrillLog" ADD COLUMN     "wireLength" TEXT;

-- AlterTable
ALTER TABLE "ThrowLog" ADD COLUMN     "wireLength" TEXT;

-- RenameIndex
ALTER INDEX "LiftingWorkoutLog_programId_weekNumber_workoutNumber_coachId_ke" RENAME TO "LiftingWorkoutLog_programId_weekNumber_workoutNumber_coachI_key";
