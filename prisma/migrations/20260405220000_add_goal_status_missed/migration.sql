-- AlterEnum: add MISSED to GoalStatus.
-- Used by the weekly-goal-transitions cron to mark expired throws goals
-- whose target was not reached — distinct from ABANDONED (explicit give-up).
ALTER TYPE "GoalStatus" ADD VALUE 'MISSED';
