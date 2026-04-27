-- Surface the last sync error per wearable connection so the UI can show
-- "Sync failed 14m ago: token refresh failed (401)" and the dashboard
-- banner can decide whether to nag.
ALTER TABLE "WhoopConnection"
  ADD COLUMN "lastSyncError" TEXT,
  ADD COLUMN "lastSyncErrorAt" TIMESTAMP(3);

ALTER TABLE "OuraConnection"
  ADD COLUMN "lastSyncError" TEXT,
  ADD COLUMN "lastSyncErrorAt" TIMESTAMP(3);
