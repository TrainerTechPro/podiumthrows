-- Streak freezes (weekly quota, refilled by cron each Sunday)
ALTER TABLE "AthleteProfile"
  ADD COLUMN "freezesAvailable" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "freezesResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastFreezeUsedAt" TIMESTAMP(3);

-- Break tracking — drives the dashboard "Rebuild from day 1" card
ALTER TABLE "AthleteProfile"
  ADD COLUMN "streakBrokenAt" TIMESTAMP(3),
  ADD COLUMN "lastBrokenStreakDays" INTEGER NOT NULL DEFAULT 0;
