-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup of e2e test data accidentally written to PRODUCTION on 2026-04-21.
--
-- Context: before the Playwright webServer env-override landed (branch
-- test/e2e-prod-safety-20260421), `npm run dev` spawned by Playwright
-- inherited .env.local — which points POSTGRES_PRISMA_URL at the production
-- Supabase pooler. Three specs ran against prod before the guardrails went in:
--
--   1. e2e/athlete-log-session.spec.ts "submit minimal session..."
--        → 1 AthleteThrowsSession + 1 AthleteDrillLog for athlete1
--          event: SHOT_PUT, drillType: "Full Throw", no distances, no focus.
--   2. e2e/athlete-quick-log-pr.spec.ts (prior version using loginViaAPI)
--        → ~3-4 ThrowLog rows for athlete1 at SHOT_PUT, today's date,
--          implementWeights in {7.26, ~5.00-5.10}, distances 10-30m.
--        → Possibly 1 AthleteThrowsSession with focus='Quick Log' if none
--          existed for SHOT_PUT today at the time.
--        → 0 ThrowsPR rows expected (the first-throw-ties-itself bug
--          prevented PR writes via quick-log).
--   3. e2e/auth.spec.ts "register new coach lands on onboarding"
--        → 1 User (role=COACH) + 1 CoachProfile per run, email shaped
--          `e2e-coach-<ms-timestamp>@test.com`.
--
-- onSessionComplete side-effects (notifications, streak updates, team activity)
-- may have fired for spec #1. Those are less clean-up-able without business
-- context — I've flagged them in the notes section below but left the SQL
-- out. Tony: decide whether you want those scrubbed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO USE THIS FILE
-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Run the "DRY RUN — review what would be deleted" SELECTs below
--         against production. Confirm the row counts and content are only
--         the test writes, not anything real.
--
-- Step 2: If the output looks right, uncomment the DELETE statements in
--         the "EXECUTE" section, one block at a time. Each block is wrapped
--         in a transaction — roll back if anything looks off.
--
-- Step 3: Re-run the DRY RUN SELECTs to confirm rows are gone.
--
-- Time bounds: the incident window on 2026-04-21 was roughly
--   09:00-11:00 America/Los_Angeles → 16:00-18:00 UTC.
-- The WHERE clauses use a wider window (00:00 UTC today → NOW()) for safety.
-- Tighten if you need to preserve legitimate writes that happened today.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- DRY RUN — review what would be deleted
-- ═════════════════════════════════════════════════════════════════════════════

-- Resolve athlete1's profile id once for all the queries below.
WITH athlete1 AS (
  SELECT ap.id AS athlete_id
  FROM "AthleteProfile" ap
  JOIN "User" u ON ap."userId" = u.id
  WHERE u.email = 'athlete1@example.com'
)

-- 1a. AthleteThrowsSession rows created today for athlete1 that smell like tests.
--     Real sessions usually have focus set (not null, not 'Quick Log' for full
--     wizard saves) and associated notes/metrics. Tests produce bare rows.
SELECT
  'AthleteThrowsSession' AS table_name,
  s.id,
  s.event,
  s.focus,
  s.date,
  s."createdAt",
  (SELECT COUNT(*) FROM "AthleteDrillLog" dl WHERE dl."sessionId" = s.id) AS drill_count,
  s."sessionRpe",
  s."sessionFeeling"
FROM "AthleteThrowsSession" s, athlete1
WHERE s."athleteId" = athlete1.athlete_id
  AND s."createdAt" >= CURRENT_DATE
  AND (
    s.focus IS NULL                -- Flow #2 full-wizard test shape
    OR s.focus = 'Quick Log'       -- Flow #3 quick-log-generated session
  )
ORDER BY s."createdAt" DESC;

-- 1b. AthleteDrillLog children of those sessions (will cascade-delete anyway
--     when the parent goes, but inspect first).
WITH athlete1 AS (
  SELECT ap.id AS athlete_id FROM "AthleteProfile" ap
  JOIN "User" u ON ap."userId" = u.id
  WHERE u.email = 'athlete1@example.com'
)
SELECT
  'AthleteDrillLog' AS table_name,
  dl.id,
  dl."drillType",
  dl."implementWeight",
  dl."throwCount",
  dl."bestMark",
  dl."createdAt"
FROM "AthleteDrillLog" dl
JOIN "AthleteThrowsSession" s ON dl."sessionId" = s.id, athlete1
WHERE s."athleteId" = athlete1.athlete_id
  AND s."createdAt" >= CURRENT_DATE
  AND (s.focus IS NULL OR s.focus = 'Quick Log');

-- 2. ThrowLog rows from Flow #3 (quick-log POSTs). Distinctive weights:
--    5.00-5.10 kg (unique-weight strategy) and 7.26 kg (earlier iteration).
--    Constrained to today + SHOT_PUT to avoid touching real data.
WITH athlete1 AS (
  SELECT ap.id AS athlete_id FROM "AthleteProfile" ap
  JOIN "User" u ON ap."userId" = u.id
  WHERE u.email = 'athlete1@example.com'
)
SELECT
  'ThrowLog' AS table_name,
  tl.id,
  tl."implementWeight",
  tl.distance,
  tl."isPersonalBest",
  tl.date
FROM "ThrowLog" tl, athlete1
WHERE tl."athleteId" = athlete1.athlete_id
  AND tl.event = 'SHOT_PUT'
  AND tl.date >= CURRENT_DATE
  AND (
    (tl."implementWeight" >= 5.0 AND tl."implementWeight" < 5.2)  -- unique-weight run
    OR (tl."implementWeight" = 7.26)                              -- earlier iteration
  )
ORDER BY tl.date DESC;

-- 3. e2e-created coach users + their profiles. Email pattern is literal.
SELECT
  'User' AS table_name,
  u.id,
  u.email,
  u.role,
  u."createdAt",
  cp.id AS coach_profile_id,
  cp."firstName",
  cp."lastName",
  cp."organization"
FROM "User" u
LEFT JOIN "CoachProfile" cp ON cp."userId" = u.id
WHERE u.email LIKE 'e2e-coach-%@test.com'
ORDER BY u."createdAt" DESC;


-- ═════════════════════════════════════════════════════════════════════════════
-- EXECUTE — uncomment the blocks you want to run, one at a time.
-- Each block wraps in a transaction. If row counts look wrong, ROLLBACK.
-- ═════════════════════════════════════════════════════════════════════════════

-- -- Block A: athlete1's test training sessions + drill logs (cascade).
-- BEGIN;
--   WITH athlete1 AS (
--     SELECT ap.id AS athlete_id FROM "AthleteProfile" ap
--     JOIN "User" u ON ap."userId" = u.id
--     WHERE u.email = 'athlete1@example.com'
--   ),
--   targets AS (
--     SELECT s.id
--     FROM "AthleteThrowsSession" s, athlete1
--     WHERE s."athleteId" = athlete1.athlete_id
--       AND s."createdAt" >= CURRENT_DATE
--       AND (s.focus IS NULL OR s.focus = 'Quick Log')
--   )
--   DELETE FROM "AthleteDrillLog" WHERE "sessionId" IN (SELECT id FROM targets);
--
--   WITH athlete1 AS (
--     SELECT ap.id AS athlete_id FROM "AthleteProfile" ap
--     JOIN "User" u ON ap."userId" = u.id
--     WHERE u.email = 'athlete1@example.com'
--   )
--   DELETE FROM "AthleteThrowsSession" s
--   USING athlete1
--   WHERE s."athleteId" = athlete1.athlete_id
--     AND s."createdAt" >= CURRENT_DATE
--     AND (s.focus IS NULL OR s.focus = 'Quick Log');
-- -- Inspect row counts before deciding:
-- -- COMMIT;
-- -- ROLLBACK;


-- -- Block B: athlete1's test throw logs from Flow #3.
-- BEGIN;
--   WITH athlete1 AS (
--     SELECT ap.id AS athlete_id FROM "AthleteProfile" ap
--     JOIN "User" u ON ap."userId" = u.id
--     WHERE u.email = 'athlete1@example.com'
--   )
--   DELETE FROM "ThrowLog" tl
--   USING athlete1
--   WHERE tl."athleteId" = athlete1.athlete_id
--     AND tl.event = 'SHOT_PUT'
--     AND tl.date >= CURRENT_DATE
--     AND (
--       (tl."implementWeight" >= 5.0 AND tl."implementWeight" < 5.2)
--       OR (tl."implementWeight" = 7.26)
--     );
-- -- COMMIT;
-- -- ROLLBACK;


-- -- Block C: e2e-created coach accounts (e2e-coach-*@test.com).
-- -- User → CoachProfile is FK'd, so delete profile first, then user.
-- BEGIN;
--   DELETE FROM "CoachProfile"
--   WHERE "userId" IN (
--     SELECT id FROM "User" WHERE email LIKE 'e2e-coach-%@test.com'
--   );
--   DELETE FROM "User" WHERE email LIKE 'e2e-coach-%@test.com';
-- -- COMMIT;
-- -- ROLLBACK;


-- ═════════════════════════════════════════════════════════════════════════════
-- NOT CLEANED UP (manual review)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- - Notification rows: onSessionComplete runs as a side-effect when Flow #2
--   submitted the session. It may have created notifications for athlete1's
--   coach (e.g. "athlete1 completed a session"). These are low-harm extras
--   in the coach's notification inbox. Query to find them:
--
--     SELECT n.*
--     FROM "Notification" n
--     JOIN "AthleteProfile" ap ON n."athleteProfileId" = ap.id
--     JOIN "User" u ON ap."userId" = u.id
--     WHERE u.email = 'athlete1@example.com'
--       AND n."createdAt" >= CURRENT_DATE
--       AND n."createdAt" < CURRENT_DATE + INTERVAL '1 day'
--       AND n.type IN ('WORKOUT_COMPLETED');
--
-- - Streak updates: updateThrowsStreak from the quick-log route bumped
--   athlete1's streak counters. Not cleanly reversible — let them decay.
--
-- - TeamActivity emitPR fanouts: only fire when a PR is registered. Flow #3
--   never registered PRs on prod due to the first-throw-ties bug, so nothing
--   to clean up here.
