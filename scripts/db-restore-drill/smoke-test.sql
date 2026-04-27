-- Podium Throws — restore-target smoke test
--
-- Run against any Postgres database that's supposed to be a faithful copy of
-- production. Compares row counts, identity hashes, and referential integrity
-- against the canonical app data. Two psql variables MUST be set:
--   :baseline_label  — text, e.g. 'restored' or 'prod'
--   (no other vars needed — counts/hashes are emitted for caller comparison)
--
-- Usage (locally):
--   PGPASSWORD=drill psql -h localhost -p 5433 -U postgres \
--     -d podium_throws_restore \
--     -v baseline_label=restored \
--     -f scripts/db-restore-drill/smoke-test.sql
--
-- Usage (against prod, read-only):
--   psql "$POSTGRES_URL_NON_POOLING" \
--     -v baseline_label=prod \
--     -f scripts/db-restore-drill/smoke-test.sql
--
-- The caller diff's the two outputs. Identical output = restore succeeded.

\set ON_ERROR_STOP on
\timing on
\pset format aligned
\pset border 2

\echo
\echo '=== ROW COUNTS ==='
SELECT 'User' AS "table", count(*) FROM "User"
UNION ALL SELECT 'CoachProfile', count(*) FROM "CoachProfile"
UNION ALL SELECT 'AthleteProfile', count(*) FROM "AthleteProfile"
UNION ALL SELECT 'TrainingSession', count(*) FROM "TrainingSession"
UNION ALL SELECT 'ThrowLog', count(*) FROM "ThrowLog"
UNION ALL SELECT 'ThrowsBlockLog', count(*) FROM "ThrowsBlockLog"
UNION ALL SELECT 'AthleteDrillLog', count(*) FROM "AthleteDrillLog"
UNION ALL SELECT 'AthleteThrowsSession', count(*) FROM "AthleteThrowsSession"
UNION ALL SELECT 'ThrowsPR', count(*) FROM "ThrowsPR"
UNION ALL SELECT 'ThrowsSession', count(*) FROM "ThrowsSession"
UNION ALL SELECT 'AuditLog', count(*) FROM "AuditLog"
UNION ALL SELECT 'StripeEvent', count(*) FROM "StripeEvent"
UNION ALL SELECT 'AthleteVideo', count(*) FROM "AthleteVideo"
UNION ALL SELECT 'Notification', count(*) FROM "Notification"
UNION ALL SELECT 'Invitation', count(*) FROM "Invitation"
UNION ALL SELECT 'PasswordResetToken', count(*) FROM "PasswordResetToken"
UNION ALL SELECT 'TokenBlacklist', count(*) FROM "TokenBlacklist"
ORDER BY 1;

\echo
\echo '=== IDENTITY HASHES (md5 of all ids, sorted) ==='
SELECT 'User' AS "table", md5(string_agg(id, ',' ORDER BY id)) AS hash, count(*) AS n FROM "User"
UNION ALL SELECT 'AthleteProfile', md5(string_agg(id, ',' ORDER BY id)), count(*) FROM "AthleteProfile"
UNION ALL SELECT 'CoachProfile', md5(string_agg(id, ',' ORDER BY id)), count(*) FROM "CoachProfile"
UNION ALL SELECT 'ThrowLog', md5(string_agg(id, ',' ORDER BY id)), count(*) FROM "ThrowLog"
UNION ALL SELECT 'TrainingSession', md5(string_agg(id, ',' ORDER BY id)), count(*) FROM "TrainingSession"
UNION ALL SELECT 'AuditLog', md5(string_agg(id, ',' ORDER BY id)), count(*) FROM "AuditLog"
ORDER BY 1;

\echo
\echo '=== REFERENTIAL INTEGRITY (every result MUST be 0) ==='
SELECT 'orphan_AthleteProfile_userId' AS probe, count(*)
  FROM "AthleteProfile" a LEFT JOIN "User" u ON a."userId" = u.id WHERE u.id IS NULL
UNION ALL SELECT 'orphan_CoachProfile_userId', count(*)
  FROM "CoachProfile" c LEFT JOIN "User" u ON c."userId" = u.id WHERE u.id IS NULL
UNION ALL SELECT 'orphan_TrainingSession_athleteId', count(*)
  FROM "TrainingSession" t LEFT JOIN "AthleteProfile" a ON t."athleteId" = a.id WHERE a.id IS NULL
UNION ALL SELECT 'orphan_ThrowLog_athleteId', count(*)
  FROM "ThrowLog" t LEFT JOIN "AthleteProfile" a ON t."athleteId" = a.id WHERE a.id IS NULL
UNION ALL SELECT 'orphan_AthleteDrillLog_sessionId', count(*)
  FROM "AthleteDrillLog" l LEFT JOIN "AthleteThrowsSession" s ON l."sessionId" = s.id WHERE s.id IS NULL
UNION ALL SELECT 'orphan_ThrowsPR_athleteId', count(*)
  FROM "ThrowsPR" p LEFT JOIN "AthleteProfile" a ON p."athleteId" = a.id WHERE a.id IS NULL
UNION ALL SELECT 'orphan_Invitation_coachId', count(*)
  FROM "Invitation" i LEFT JOIN "CoachProfile" c ON i."coachId" = c.id WHERE c.id IS NULL
ORDER BY 1;

\echo
\echo '=== SAMPLE JOIN — 3-level deep traversal ==='
SELECT count(*) AS coachable_athletes
FROM "User" u
JOIN "AthleteProfile" a ON a."userId" = u.id
JOIN "CoachProfile" c ON c.id = a."coachId"
JOIN "User" cu ON cu.id = c."userId";
