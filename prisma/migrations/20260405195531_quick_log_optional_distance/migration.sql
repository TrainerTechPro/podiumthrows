-- AlterTable: make ThrowLog.distance nullable for Quick Log (tap-to-count without distance)
ALTER TABLE "ThrowLog" ALTER COLUMN "distance" DROP NOT NULL;
