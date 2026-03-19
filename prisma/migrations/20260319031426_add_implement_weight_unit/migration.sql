-- AlterTable
ALTER TABLE "AthleteDrillLog" ADD COLUMN     "implementWeightOriginal" DOUBLE PRECISION,
ADD COLUMN     "implementWeightUnit" TEXT NOT NULL DEFAULT 'kg';

-- AlterTable
ALTER TABLE "CoachDrillLog" ADD COLUMN     "implementWeightOriginal" DOUBLE PRECISION,
ADD COLUMN     "implementWeightUnit" TEXT NOT NULL DEFAULT 'kg';

-- AlterTable
ALTER TABLE "ThrowLog" ADD COLUMN     "implementWeightOriginal" DOUBLE PRECISION,
ADD COLUMN     "implementWeightUnit" TEXT NOT NULL DEFAULT 'kg';
