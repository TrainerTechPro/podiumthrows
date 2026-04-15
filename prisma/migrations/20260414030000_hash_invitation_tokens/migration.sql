-- Migration: hash existing PENDING invitation tokens with SHA-256.
--
-- Security rationale: raw tokens in the DB meant a database compromise would
-- reveal every live invite URL. After this migration, the DB stores only the
-- hash; the raw token lives solely in the recipient's email. The server-side
-- code rehashes incoming tokens on lookup, so existing emails keep working.
--
-- Idempotency: gated by status = 'PENDING' and the migration system only runs
-- this file once per environment. Running a second time against already-hashed
-- rows would double-hash them (and break them), but Prisma prevents reruns.
--
-- Rollback: no clean rollback. Pending invites issued before this migration
-- cannot be un-hashed because we only store the hash. Revoke + re-issue is
-- the recovery path if rollback is ever needed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "Invitation"
SET token = encode(digest(token, 'sha256'), 'hex')
WHERE status = 'PENDING';
