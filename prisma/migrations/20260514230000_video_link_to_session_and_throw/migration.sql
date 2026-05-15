-- Link videos to the training data they capture. The spec marks "video tools
-- disconnected from training data" as an anti-reference, so every video row
-- can optionally hang off a TrainingSession and/or a single ThrowLog. Both
-- FKs are nullable so legacy rows stay valid, and SetNull on delete preserves
-- the video when its anchor goes away.

-- VideoUpload (legacy table — still has FrameAnnotation children)
ALTER TABLE "VideoUpload"
  ADD COLUMN "sessionId"  TEXT,
  ADD COLUMN "throwLogId" TEXT;

ALTER TABLE "VideoUpload"
  ADD CONSTRAINT "VideoUpload_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "TrainingSession"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "VideoUpload"
  ADD CONSTRAINT "VideoUpload_throwLogId_fkey"
    FOREIGN KEY ("throwLogId")
    REFERENCES "ThrowLog"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX "VideoUpload_sessionId_idx"  ON "VideoUpload"("sessionId");
CREATE INDEX "VideoUpload_throwLogId_idx" ON "VideoUpload"("throwLogId");

-- VideoAnalysis (live table written by /api/video-analysis/upload)
ALTER TABLE "VideoAnalysis"
  ADD COLUMN "sessionId"  TEXT,
  ADD COLUMN "throwLogId" TEXT;

ALTER TABLE "VideoAnalysis"
  ADD CONSTRAINT "VideoAnalysis_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "TrainingSession"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "VideoAnalysis"
  ADD CONSTRAINT "VideoAnalysis_throwLogId_fkey"
    FOREIGN KEY ("throwLogId")
    REFERENCES "ThrowLog"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX "VideoAnalysis_sessionId_idx"  ON "VideoAnalysis"("sessionId");
CREATE INDEX "VideoAnalysis_throwLogId_idx" ON "VideoAnalysis"("throwLogId");
