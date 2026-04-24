-- PR 2 Schema Consolidation — Read-only profiling queries
--
-- Read-only. Paste into Supabase SQL editor for project `bfmswuxblbwomntvkwdw`
-- (prod) → run each section → export results as CSV →
-- save to `tasks/schema-consolidation-query-results/<section>.csv`.
--
-- Every query in this file is SELECT-only. No INSERT, UPDATE, DELETE, ALTER,
-- CREATE, DROP, TRUNCATE. If a query below doesn't match that constraint,
-- do NOT run it and flag it here.
--
-- Companion doc: tasks/schema-consolidation-manifest.md. Section numbers
-- below map to manifest §3 (field-by-field diffs) so results land in the
-- right place when back-filling.
--
-- Expected execution time: <30 s for all sections against a healthy
-- Postgres instance. If any query takes >30 s, cancel and report — the
-- table might be missing an index we need to add before MODE: PLAN.

-- ────────────────────────────────────────────────────────────────────────
-- Section 0 — Row counts across all eight models
-- ────────────────────────────────────────────────────────────────────────

SELECT 'ThrowsPR'              AS model, count(*)::bigint AS rows FROM "ThrowsPR"
UNION ALL SELECT 'CoachPR',              count(*)::bigint FROM "CoachPR"
UNION ALL SELECT 'ThrowsTyping',         count(*)::bigint FROM "ThrowsTyping"
UNION ALL SELECT 'CoachTyping',          count(*)::bigint FROM "CoachTyping"
UNION ALL SELECT 'AthleteThrowsSession', count(*)::bigint FROM "AthleteThrowsSession"
UNION ALL SELECT 'CoachThrowsSession',   count(*)::bigint FROM "CoachThrowsSession"
UNION ALL SELECT 'AthleteDrillLog',      count(*)::bigint FROM "AthleteDrillLog"
UNION ALL SELECT 'CoachDrillLog',        count(*)::bigint FROM "CoachDrillLog";

-- Export as: section-0-row-counts.csv

-- ────────────────────────────────────────────────────────────────────────
-- Section 1 — CoachPR ↔ ThrowsPR  (manifest §3.1)
-- ────────────────────────────────────────────────────────────────────────

-- 1a. CoachPR — usage of fields that have no athlete-side equivalent.
-- Non-zero on `sessionId` / `drillType` means those columns must survive
-- as nullable on the unified table. A non-default `source` means the
-- migration can't collapse to athlete's simpler TRAINING/COMPETITION.
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "sessionId" IS NOT NULL)               AS with_sessionId,
  count(*) FILTER (WHERE "drillType" IS NOT NULL)               AS with_drillType,
  count(*) FILTER (WHERE "source" IS DISTINCT FROM 'session')   AS with_nondefault_source,
  count(DISTINCT "source")                                      AS distinct_source_values
FROM "CoachPR";
-- Export as: section-1a-coachpr-coach-only-fields.csv

-- 1b. Distribution of `source` values on both sides (expected: coach→'session' dominant, athlete→'TRAINING'/'COMPETITION').
SELECT 'ThrowsPR' AS side, "source", count(*) FROM "ThrowsPR" GROUP BY 1,2
UNION ALL
SELECT 'CoachPR',        "source", count(*) FROM "CoachPR"   GROUP BY 1,2
ORDER BY 1, 3 DESC;
-- Export as: section-1b-source-distribution.csv

-- 1c. Field-level null profile on ThrowsPR (everything nullable).
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "source" IS NULL)                      AS null_source,
  count(DISTINCT "athleteId")                                   AS distinct_athletes,
  count(DISTINCT "event")                                       AS distinct_events,
  count(DISTINCT "implement")                                   AS distinct_implements,
  MIN("createdAt")                                              AS oldest_createdAt,
  MAX("createdAt")                                              AS newest_createdAt,
  MIN("updatedAt")                                              AS oldest_updatedAt,
  MAX("updatedAt")                                              AS newest_updatedAt
FROM "ThrowsPR";
-- Export as: section-1c-throwspr-profile.csv

-- 1d. Field-level null profile on CoachPR.
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "source" IS NULL)                      AS null_source,
  count(*) FILTER (WHERE "sessionId" IS NULL)                   AS null_sessionId,
  count(*) FILTER (WHERE "drillType" IS NULL)                   AS null_drillType,
  count(DISTINCT "coachId")                                     AS distinct_coaches,
  count(DISTINCT "event")                                       AS distinct_events,
  count(DISTINCT "implement")                                   AS distinct_implements,
  MIN("achievedAt")                                             AS oldest_achievedAt,
  MAX("achievedAt")                                             AS newest_achievedAt
FROM "CoachPR";
-- Export as: section-1d-coachpr-profile.csv

-- 1e. Cross-check: does the `event` type diff (string vs enum) have
-- any real-world inconsistencies? Every athlete PR should have one of
-- SHOT_PUT / DISCUS / HAMMER / JAVELIN in the text column.
SELECT "event", count(*)
FROM "ThrowsPR"
WHERE "event" NOT IN ('SHOT_PUT', 'DISCUS', 'HAMMER', 'JAVELIN')
GROUP BY 1;
-- Expected zero rows. Any match = data cleanup needed before migration.
-- Export as: section-1e-throwspr-event-invalid.csv

-- ────────────────────────────────────────────────────────────────────────
-- Section 2 — CoachTyping ↔ ThrowsTyping  (manifest §3.2)
-- ────────────────────────────────────────────────────────────────────────

-- 2a. CoachTyping — coach-side *Label + *Conf + methodReason usage.
-- Any column here showing nonzero means the field must survive as nullable
-- on the unified table. All-zero columns are candidates for removal.
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "adaptationLabel"     IS NOT NULL)     AS with_adaptationLabel,
  count(*) FILTER (WHERE "adaptationConf"      IS NOT NULL)     AS with_adaptationConf,
  count(*) FILTER (WHERE "transferLabel"       IS NOT NULL)     AS with_transferLabel,
  count(*) FILTER (WHERE "transferConf"        IS NOT NULL)     AS with_transferConf,
  count(*) FILTER (WHERE "selfFeelingLabel"    IS NOT NULL)     AS with_selfFeelingLabel,
  count(*) FILTER (WHERE "selfFeelingConf"     IS NOT NULL)     AS with_selfFeelingConf,
  count(*) FILTER (WHERE "lightImplLabel"      IS NOT NULL)     AS with_lightImplLabel,
  count(*) FILTER (WHERE "lightImplConf"       IS NOT NULL)     AS with_lightImplConf,
  count(*) FILTER (WHERE "recoveryLabel"       IS NOT NULL)     AS with_recoveryLabel,
  count(*) FILTER (WHERE "recoveryConf"        IS NOT NULL)     AS with_recoveryConf,
  count(*) FILTER (WHERE "methodReason"        IS NOT NULL)     AS with_methodReason
FROM "CoachTyping";
-- Export as: section-2a-coachtyping-coach-only-fields.csv

-- 2b. ThrowsTyping — athlete-side fields without a coach-side equivalent.
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "typingSource"         <> 'QUIZ')      AS with_nonquiz_source,
  count(DISTINCT "typingSource")                                AS distinct_typingSource_values,
  count(*) FILTER (WHERE "quizAssignedByCoach"  = true)         AS with_coach_assigned_quiz,
  count(*) FILTER (WHERE "complexesAnalyzed"    > 0)            AS with_complexes,
  count(*) FILTER (WHERE "totalSessionsTracked" > 0)            AS with_sessions_tracked,
  MAX("complexesAnalyzed")                                      AS max_complexesAnalyzed,
  MAX("totalSessionsTracked")                                   AS max_totalSessionsTracked
FROM "ThrowsTyping";
-- Export as: section-2b-throwstyping-athlete-only-fields.csv

-- 2c. Cross-check renames: ThrowsTyping has `optimalComplexDuration` +
-- `estimatedSessionsToForm`; CoachTyping has `complexDuration` +
-- `sessionsToForm`. Confirm both sides populate their versions.
SELECT
  'ThrowsTyping' AS side,
  count(*) FILTER (WHERE "optimalComplexDuration"  IS NOT NULL) AS with_complex_duration,
  count(*) FILTER (WHERE "estimatedSessionsToForm" IS NOT NULL) AS with_sessions_to_form
FROM "ThrowsTyping"
UNION ALL
SELECT
  'CoachTyping',
  count(*) FILTER (WHERE "complexDuration" IS NOT NULL),
  count(*) FILTER (WHERE "sessionsToForm"  IS NOT NULL)
FROM "CoachTyping";
-- Export as: section-2c-rename-pair-population.csv

-- 2d. Date-column distribution. ThrowsTyping uses strings; CoachTyping uses DateTime.
-- Confirm ThrowsTyping's string dates are all valid YYYY-MM-DD before the
-- backfill migration normalizes them.
SELECT
  'ThrowsTyping' AS side,
  count(*) FILTER (WHERE "quizCompletedDate" ~ '^\d{4}-\d{2}-\d{2}$') AS valid_iso_dates,
  count(*) FILTER (WHERE "quizCompletedDate" IS NOT NULL
                   AND "quizCompletedDate" !~ '^\d{4}-\d{2}-\d{2}$')  AS invalid_format,
  count(*) FILTER (WHERE "quizCompletedDate" IS NULL)                 AS null_dates,
  MIN("quizCompletedDate")                                             AS oldest_string,
  MAX("quizCompletedDate")                                             AS newest_string
FROM "ThrowsTyping"
UNION ALL
SELECT
  'CoachTyping',
  count(*),
  0,
  count(*) FILTER (WHERE "completedAt" IS NULL),
  MIN("completedAt")::text,
  MAX("completedAt")::text
FROM "CoachTyping";
-- Export as: section-2d-date-column-profile.csv

-- ────────────────────────────────────────────────────────────────────────
-- Section 3 — AthleteThrowsSession ↔ CoachThrowsSession  (manifest §3.3)
-- ────────────────────────────────────────────────────────────────────────

-- 3a. AthleteThrowsSession.loggedByCoach — how many "coach entered this
-- for the athlete" rows exist? High count → unified table needs an
-- enteredByUserId column to preserve attribution.
SELECT
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "loggedByCoach" = true)                AS logged_by_coach,
  count(*) FILTER (WHERE "loggedByCoach" = false)               AS logged_by_athlete,
  count(DISTINCT "athleteId")                                   AS distinct_athletes,
  MIN("date")                                                   AS oldest_date,
  MAX("date")                                                   AS newest_date
FROM "AthleteThrowsSession";
-- Export as: section-3a-athlete-session-profile.csv

-- 3b. CoachThrowsSession profile.
SELECT
  count(*)                                                      AS total_rows,
  count(DISTINCT "coachId")                                     AS distinct_coaches,
  MIN("date")                                                   AS oldest_date,
  MAX("date")                                                   AS newest_date
FROM "CoachThrowsSession";
-- Export as: section-3b-coach-session-profile.csv

-- 3c. Event-column validity on both sides (same check as §1e but for sessions).
SELECT 'AthleteThrowsSession' AS side, "event", count(*)
FROM "AthleteThrowsSession"
WHERE "event" NOT IN ('SHOT_PUT', 'DISCUS', 'HAMMER', 'JAVELIN')
GROUP BY 1, 2;
-- Expected zero rows. Export as: section-3c-athlete-session-event-invalid.csv

-- 3d. Shared-column null profile — nullable feedback fields.
-- Useful to know what percentage of sessions have RPE, feeling, etc.
SELECT
  'AthleteThrowsSession' AS side,
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "sessionRpe"      IS NOT NULL)         AS with_rpe,
  count(*) FILTER (WHERE "sessionFeeling"  IS NOT NULL)         AS with_feeling,
  count(*) FILTER (WHERE "techniqueRating" IS NOT NULL)         AS with_technique,
  count(*) FILTER (WHERE "mentalFocus"     IS NOT NULL)         AS with_mental,
  count(*) FILTER (WHERE "sleepQuality"    IS NOT NULL)         AS with_sleep,
  count(*) FILTER (WHERE "sorenessLevel"   IS NOT NULL)         AS with_soreness,
  count(*) FILTER (WHERE "energyLevel"     IS NOT NULL)         AS with_energy
FROM "AthleteThrowsSession"
UNION ALL
SELECT
  'CoachThrowsSession',
  count(*),
  count(*) FILTER (WHERE "sessionRpe"      IS NOT NULL),
  count(*) FILTER (WHERE "sessionFeeling"  IS NOT NULL),
  count(*) FILTER (WHERE "techniqueRating" IS NOT NULL),
  count(*) FILTER (WHERE "mentalFocus"     IS NOT NULL),
  count(*) FILTER (WHERE "sleepQuality"    IS NOT NULL),
  count(*) FILTER (WHERE "sorenessLevel"   IS NOT NULL),
  count(*) FILTER (WHERE "energyLevel"     IS NOT NULL)
FROM "CoachThrowsSession";
-- Export as: section-3d-shared-field-null-profile.csv

-- ────────────────────────────────────────────────────────────────────────
-- Section 4 — AthleteDrillLog ↔ CoachDrillLog  (manifest §3.4)
-- ────────────────────────────────────────────────────────────────────────

-- 4a. Field-population parity. Zero diffs expected since pair is nearly
-- identical, but worth confirming in prod before unifying.
SELECT
  'AthleteDrillLog' AS side,
  count(*)                                                      AS total_rows,
  count(*) FILTER (WHERE "implementWeight"    IS NOT NULL)      AS with_weight,
  count(*) FILTER (WHERE "implementWeightOriginal" IS NOT NULL) AS with_weight_original,
  count(*) FILTER (WHERE "wireLength"         IS NOT NULL)      AS with_wire,
  count(*) FILTER (WHERE "bestMark"           IS NOT NULL)      AS with_best_mark,
  count(*) FILTER (WHERE "bestMarkOriginal"   IS NOT NULL)      AS with_best_mark_original,
  count(*) FILTER (WHERE "notes"              IS NOT NULL)      AS with_notes,
  avg("throwCount")::numeric(10,2)                              AS avg_throws,
  MAX("throwCount")                                             AS max_throws
FROM "AthleteDrillLog"
UNION ALL
SELECT
  'CoachDrillLog',
  count(*),
  count(*) FILTER (WHERE "implementWeight"    IS NOT NULL),
  count(*) FILTER (WHERE "implementWeightOriginal" IS NOT NULL),
  count(*) FILTER (WHERE "wireLength"         IS NOT NULL),
  count(*) FILTER (WHERE "bestMark"           IS NOT NULL),
  count(*) FILTER (WHERE "bestMarkOriginal"   IS NOT NULL),
  count(*) FILTER (WHERE "notes"              IS NOT NULL),
  avg("throwCount")::numeric(10,2),
  MAX("throwCount")
FROM "CoachDrillLog";
-- Export as: section-4a-drilllog-parity.csv

-- 4b. Distinct drillType values on both sides. Should be the same finite set.
SELECT 'AthleteDrillLog' AS side, "drillType", count(*)
FROM "AthleteDrillLog" GROUP BY 1,2
UNION ALL
SELECT 'CoachDrillLog',           "drillType", count(*)
FROM "CoachDrillLog"   GROUP BY 1,2
ORDER BY 1, 3 DESC;
-- Export as: section-4b-drilltype-distribution.csv

-- 4c. Distinct wireLength values (hammer-only). Expected: FULL / THREE_QUARTER / HALF / NULL.
SELECT 'AthleteDrillLog' AS side, "wireLength", count(*)
FROM "AthleteDrillLog" GROUP BY 1,2
UNION ALL
SELECT 'CoachDrillLog',           "wireLength", count(*)
FROM "CoachDrillLog"   GROUP BY 1,2
ORDER BY 1, 3 DESC;
-- Export as: section-4c-wirelength-distribution.csv

-- ────────────────────────────────────────────────────────────────────────
-- Section 5 — FK referential counts  (inbound edges, manifest §4)
-- ────────────────────────────────────────────────────────────────────────

-- 5a. AthleteProfile → each athlete-side model. Confirms manifest §4 claim
-- that each model is only referenced via the parent back-ref.
SELECT
  'AthleteProfile.throwsPRs'         AS relation, count(*) FROM "ThrowsPR"
UNION ALL SELECT 'AthleteProfile.throwsTyping',      count(*) FROM "ThrowsTyping"
UNION ALL SELECT 'AthleteProfile.selfLoggedSessions', count(*) FROM "AthleteThrowsSession"
UNION ALL SELECT 'AthleteThrowsSession.drillLogs',    count(*) FROM "AthleteDrillLog"
UNION ALL SELECT 'CoachProfile.coachPRs',             count(*) FROM "CoachPR"
UNION ALL SELECT 'CoachProfile.coachTyping',          count(*) FROM "CoachTyping"
UNION ALL SELECT 'CoachProfile.selfLoggedSessions',   count(*) FROM "CoachThrowsSession"
UNION ALL SELECT 'CoachThrowsSession.drillLogs',      count(*) FROM "CoachDrillLog";
-- Export as: section-5a-inbound-fk-counts.csv

-- 5b. Orphan check — any DrillLog whose parent session is missing?
-- Should be 0 because ON DELETE CASCADE is set, but prod reality sometimes
-- drifts. Nonzero → data cleanup before migration.
SELECT
  'AthleteDrillLog orphans' AS check, count(*)
FROM "AthleteDrillLog" d
LEFT JOIN "AthleteThrowsSession" s ON d."sessionId" = s.id
WHERE s.id IS NULL
UNION ALL
SELECT
  'CoachDrillLog orphans',
  count(*)
FROM "CoachDrillLog" d
LEFT JOIN "CoachThrowsSession" s ON d."sessionId" = s.id
WHERE s.id IS NULL
UNION ALL
SELECT
  'ThrowsPR athleteless',
  count(*)
FROM "ThrowsPR" p
LEFT JOIN "AthleteProfile" a ON p."athleteId" = a.id
WHERE a.id IS NULL
UNION ALL
SELECT
  'CoachPR coachless',
  count(*)
FROM "CoachPR" p
LEFT JOIN "CoachProfile" c ON p."coachId" = c.id
WHERE c.id IS NULL;
-- Expected zero across all rows. Export as: section-5b-orphan-check.csv

-- ────────────────────────────────────────────────────────────────────────
-- Section 6 — Coach-as-athlete overlap  (informational)
-- ────────────────────────────────────────────────────────────────────────

-- 6a. How many Users have both a CoachProfile AND an AthleteProfile?
-- This is the entire reason the duplicate pairs exist. Low number here
-- means the feature serves few users; high number means consolidation
-- is really a priority.
SELECT
  count(*) AS users_with_both_profiles
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "CoachProfile"   c WHERE c."userId" = u.id)
  AND EXISTS (SELECT 1 FROM "AthleteProfile" a WHERE a."userId" = u.id);
-- Export as: section-6a-dual-profile-count.csv

-- 6b. Of dual-profile users, how many actually USE both sides
-- (nonzero rows in at least one athlete-side model AND one coach-side model)?
SELECT
  count(*) AS dual_profile_users_active_on_both_sides
FROM "User" u
WHERE EXISTS (
    SELECT 1 FROM "AthleteProfile" a
    WHERE a."userId" = u.id
      AND (
        EXISTS (SELECT 1 FROM "ThrowsPR"             WHERE "athleteId" = a.id)
     OR EXISTS (SELECT 1 FROM "ThrowsTyping"         WHERE "athleteId" = a.id)
     OR EXISTS (SELECT 1 FROM "AthleteThrowsSession" WHERE "athleteId" = a.id)
      )
  )
  AND EXISTS (
    SELECT 1 FROM "CoachProfile" c
    WHERE c."userId" = u.id
      AND (
        EXISTS (SELECT 1 FROM "CoachPR"            WHERE "coachId" = c.id)
     OR EXISTS (SELECT 1 FROM "CoachTyping"        WHERE "coachId" = c.id)
     OR EXISTS (SELECT 1 FROM "CoachThrowsSession" WHERE "coachId" = c.id)
      )
  );
-- Export as: section-6b-dual-profile-active-count.csv

-- ────────────────────────────────────────────────────────────────────────
-- End of read-only profile.
--
-- Next action: paste each result CSV into tasks/schema-consolidation-query-results/
-- matching the filenames in the comments above. The manifest back-fill
-- slots expect these exact filenames.
-- ────────────────────────────────────────────────────────────────────────
