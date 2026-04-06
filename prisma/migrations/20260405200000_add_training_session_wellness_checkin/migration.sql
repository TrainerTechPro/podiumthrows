-- AlterTable: add post-session wellness check-in (3 emoji answers + timestamp)
-- Shape: { legs: 1|2|3, energy: 1|2|3, focus: 1|2|3, submittedAt: ISO string }
ALTER TABLE "TrainingSession" ADD COLUMN "wellnessCheckin" JSONB;
