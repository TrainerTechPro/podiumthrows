-- Synthetic monitoring sentinel flag. Marks the smoke@ accounts created by
-- scripts/upsert-smoke-accounts.ts so cleanup paths can opt them out of
-- destructive operations. The 2026-04-11 incident wiped all real users when
-- seed.ts ran with prod credentials — this column is the durable safety belt
-- for the smoke accounts that come next, since they're the only authenticated
-- probe targets in prod and recreating them requires a manual one-shot.
ALTER TABLE "User"
  ADD COLUMN "isSmokeAccount" BOOLEAN NOT NULL DEFAULT false;
