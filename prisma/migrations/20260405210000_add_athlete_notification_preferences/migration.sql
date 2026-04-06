-- AlterTable: add client-side notification preferences for cross-device sync.
-- Shape: { streakReminder: { enabled: bool, promptDismissed: bool } }
ALTER TABLE "AthleteProfile" ADD COLUMN "notificationPreferences" JSONB;
