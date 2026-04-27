-- Content search infrastructure (P1-2 follow-on)
-- Enables Postgres trigram similarity matching across coach-authored prose
-- (notes, session/program text, drill descriptions, video annotations).
--
-- pg_trgm ships with every Postgres distribution Vercel runs and on local dev;
-- IF NOT EXISTS keeps the migration idempotent across environments where the
-- extension was previously enabled by hand.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes with gin_trgm_ops — these accelerate both ILIKE '%term%' and
-- the similarity()/word_similarity() operators we use for ranked search.
-- Each index is scoped to a single column; multi-column trigram indexes are
-- not supported (the operator class is per-column).

-- Coach notes — the highest-cardinality and most-search-valuable surface.
CREATE INDEX IF NOT EXISTS "CoachNote_content_trgm_idx"
  ON "CoachNote" USING gin ("content" gin_trgm_ops);

-- Session content — name (already short) + free-form coach notes.
CREATE INDEX IF NOT EXISTS "ThrowsSession_name_trgm_idx"
  ON "ThrowsSession" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ThrowsSession_notes_trgm_idx"
  ON "ThrowsSession" USING gin ("notes" gin_trgm_ops);

-- Drill library — coaches search "hip drive", "shoulder separation", etc.
CREATE INDEX IF NOT EXISTS "Drill_name_trgm_idx"
  ON "Drill" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Drill_description_trgm_idx"
  ON "Drill" USING gin ("description" gin_trgm_ops);

-- Programs (workout plans).
CREATE INDEX IF NOT EXISTS "WorkoutPlan_name_trgm_idx"
  ON "WorkoutPlan" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "WorkoutPlan_description_trgm_idx"
  ON "WorkoutPlan" USING gin ("description" gin_trgm_ops);

-- Video annotations — title + description live on VideoAnalysis.
-- (Per-frame keyPositions notes are JSON; out of scope for v1 GIN indexing.)
CREATE INDEX IF NOT EXISTS "VideoAnalysis_title_trgm_idx"
  ON "VideoAnalysis" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "VideoAnalysis_description_trgm_idx"
  ON "VideoAnalysis" USING gin ("description" gin_trgm_ops);

-- Athlete-side feedback that coaches still want to surface in deep search.
CREATE INDEX IF NOT EXISTS "ThrowsAssignment_feedbackNotes_trgm_idx"
  ON "ThrowsAssignment" USING gin ("feedbackNotes" gin_trgm_ops);

-- Block-level coach notes inside programs.
CREATE INDEX IF NOT EXISTS "WorkoutBlock_notes_trgm_idx"
  ON "WorkoutBlock" USING gin ("notes" gin_trgm_ops);
