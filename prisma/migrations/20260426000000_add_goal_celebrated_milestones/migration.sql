-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "celebratedMilestones" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
