-- AlterTable
ALTER TABLE "AthleteDrillLog" ADD COLUMN     "bestMarkUnit" TEXT NOT NULL DEFAULT 'meters',
ADD COLUMN     "bestMarkOriginal" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CoachDrillLog" ADD COLUMN     "bestMarkUnit" TEXT NOT NULL DEFAULT 'meters',
ADD COLUMN     "bestMarkOriginal" DOUBLE PRECISION;
