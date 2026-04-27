-- DrillVideoView powers "unseen" filtering in recommendations and click-through
-- rate analytics for the WatchNextOverlay.
CREATE TABLE "DrillVideoView" (
  "id" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "drillVideoId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "recommendedFromId" TEXT,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DrillVideoView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrillVideoView_athleteId_drillVideoId_idx" ON "DrillVideoView"("athleteId", "drillVideoId");
CREATE INDEX "DrillVideoView_athleteId_viewedAt_idx" ON "DrillVideoView"("athleteId", "viewedAt");
CREATE INDEX "DrillVideoView_drillVideoId_viewedAt_idx" ON "DrillVideoView"("drillVideoId", "viewedAt");
CREATE INDEX "DrillVideoView_recommendedFromId_idx" ON "DrillVideoView"("recommendedFromId");

ALTER TABLE "DrillVideoView"
  ADD CONSTRAINT "DrillVideoView_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrillVideoView"
  ADD CONSTRAINT "DrillVideoView_drillVideoId_fkey"
  FOREIGN KEY ("drillVideoId") REFERENCES "DrillVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrillVideoView"
  ADD CONSTRAINT "DrillVideoView_recommendedFromId_fkey"
  FOREIGN KEY ("recommendedFromId") REFERENCES "DrillVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
