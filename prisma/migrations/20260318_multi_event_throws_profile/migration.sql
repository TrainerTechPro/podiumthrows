-- DropIndex
DROP INDEX IF EXISTS "ThrowsProfile_athleteId_key";

-- CreateIndex (composite unique: one profile per athlete per event)
CREATE UNIQUE INDEX "ThrowsProfile_athleteId_event_key" ON "ThrowsProfile"("athleteId", "event");

-- CreateIndex (for efficient lookups by athleteId)
CREATE INDEX "ThrowsProfile_athleteId_idx" ON "ThrowsProfile"("athleteId");
