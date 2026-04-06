-- AlterTable: extend ThrowComment with per-comment read tracking and
-- lightweight recipient acknowledgment.
--
--   readAt    → when the OTHER party opened/viewed this comment
--   reaction  → "THUMBS_UP" | "THUMBS_DOWN" ack from the recipient
--   replyText → short text ack from the recipient (not a full reply)
--
-- All additive and nullable.

ALTER TABLE "ThrowComment" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "ThrowComment" ADD COLUMN "reaction" TEXT;
ALTER TABLE "ThrowComment" ADD COLUMN "replyText" TEXT;

-- Index to speed up "unread coach feedback for athlete X" queries that
-- power the dashboard red dot and the athlete feedback page.
CREATE INDEX "ThrowComment_authorRole_readAt_idx" ON "ThrowComment"("authorRole", "readAt");
