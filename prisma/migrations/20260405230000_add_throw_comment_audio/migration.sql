-- AlterTable: extend ThrowComment with voice-note support.
-- Voice feedback now travels on the same row as text feedback —
-- authors set EITHER body (text) OR audioUrl (voice), not both.
-- audioDurationSec is the length of the recorded clip in seconds.

ALTER TABLE "ThrowComment" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "ThrowComment" ADD COLUMN "audioDurationSec" INTEGER;
