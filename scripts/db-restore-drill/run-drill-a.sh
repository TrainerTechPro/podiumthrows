#!/usr/bin/env bash
# Drill A — pg_dump prod → restore to local Postgres → smoke test.
#
# Validates the dump+restore mechanics end-to-end without touching prod or
# provisioning paid cloud infra. Costs $0. Does NOT validate Supabase's
# physical-backup restore-to-new-project flow (see Drill B in the runbook).
#
# Prerequisites:
#   - Docker daemon running
#   - supabase CLI installed (brew install supabase/tap/supabase)
#   - .env.local present with POSTGRES_URL_NON_POOLING set to prod
#   - psql client installed (any 14+; the container is pg17)
#
# Usage:  ./scripts/db-restore-drill/run-drill-a.sh
# Output: writes timing + smoke results under /tmp/pt-restore-drill-<TS>/

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Resolve prod URL from .env.local (read-only on this side; never written back).
if [[ ! -f .env.local ]]; then
  echo "ERROR: .env.local not found at $REPO_ROOT" >&2
  exit 1
fi
PROD_URL="$(grep -E '^POSTGRES_URL_NON_POOLING=' .env.local | cut -d= -f2- | tr -d '"')"
if [[ -z "$PROD_URL" ]]; then
  echo "ERROR: POSTGRES_URL_NON_POOLING not set in .env.local" >&2
  exit 1
fi

DRILL_TS="$(date -u +%Y%m%dT%H%M%SZ)"
DRILL_DIR="/tmp/pt-restore-drill-$DRILL_TS"
mkdir -p "$DRILL_DIR"
TIMING="$DRILL_DIR/timing.log"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log_ts() { local k="$1"; echo "$k=$(ts)" | tee -a "$TIMING"; }

echo "Drill A — output dir: $DRILL_DIR"
log_ts T_drill_start

# ── 1. Pull dumps from prod (read-only) ─────────────────────────────────────
log_ts T_dump_roles_start
supabase db dump --db-url "$PROD_URL" --role-only -f "$DRILL_DIR/roles.sql" >/dev/null
log_ts T_dump_roles_end

log_ts T_dump_schema_start
supabase db dump --db-url "$PROD_URL" -f "$DRILL_DIR/schema.sql" >/dev/null
log_ts T_dump_schema_end

# Public-only data dump. The auth/storage schemas are Supabase-managed and
# don't restore into vanilla Postgres — see runbook §"Failure modes" #1.
log_ts T_dump_data_start
supabase db dump --db-url "$PROD_URL" --data-only --use-copy --schema public \
  -f "$DRILL_DIR/data.sql" >/dev/null
log_ts T_dump_data_end

# ── 2. Provision target (local pg17 in Docker) ──────────────────────────────
CONTAINER="pt-restore-drill-$DRILL_TS"
log_ts T_provision_start
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=drill \
  -e POSTGRES_DB=podium_throws_restore \
  -p 5433:5432 postgres:17 >/dev/null

# Wait for ready (max 30s)
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
log_ts T_provision_end

# ── 3. Bootstrap Supabase-specific roles (so GRANT statements don't fail) ───
cat > "$DRILL_DIR/prep.sql" <<'SQL'
CREATE ROLE supabase_admin WITH SUPERUSER LOGIN;
CREATE ROLE supabase_auth_admin WITH LOGIN;
CREATE ROLE supabase_storage_admin WITH LOGIN;
CREATE ROLE supabase_realtime_admin WITH LOGIN;
CREATE ROLE supabase_replication_admin WITH LOGIN REPLICATION;
CREATE ROLE supabase_read_only_user WITH LOGIN;
CREATE ROLE supabase_etl_admin WITH LOGIN;
CREATE ROLE supabase_privileged_role;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE dashboard_user;
CREATE ROLE pgbouncer NOLOGIN;
SQL

PSQL="PGPASSWORD=drill psql -h localhost -p 5433 -U postgres -d podium_throws_restore"
eval "$PSQL -v ON_ERROR_STOP=1 -f \"$DRILL_DIR/prep.sql\"" >/dev/null

# ── 4. Restore ──────────────────────────────────────────────────────────────
log_ts T_restore_schema_start
eval "$PSQL -f \"$DRILL_DIR/schema.sql\"" > "$DRILL_DIR/schema_apply.log" 2>&1
log_ts T_restore_schema_end

log_ts T_restore_data_start
eval "$PSQL --single-transaction --command 'SET session_replication_role = replica' --file \"$DRILL_DIR/data.sql\"" \
  > "$DRILL_DIR/data_apply.log" 2>&1
log_ts T_restore_data_end

# ── 5. Smoke test ───────────────────────────────────────────────────────────
log_ts T_smoke_start
eval "$PSQL -v baseline_label=restored -f \"$REPO_ROOT/scripts/db-restore-drill/smoke-test.sql\"" \
  > "$DRILL_DIR/smoke_restored.txt" 2>&1
psql "$PROD_URL" -v baseline_label=prod \
  -f "$REPO_ROOT/scripts/db-restore-drill/smoke-test.sql" \
  > "$DRILL_DIR/smoke_prod.txt" 2>&1
log_ts T_smoke_end

# ── 6. Diff ─────────────────────────────────────────────────────────────────
echo
echo "=== smoke diff (empty = success; psql 'Time:' lines stripped) ==="
# psql's \timing emits per-query duration which differs naturally between
# environments. We compare semantic output only.
if diff -u \
     <(grep -v "^Time:" "$DRILL_DIR/smoke_prod.txt") \
     <(grep -v "^Time:" "$DRILL_DIR/smoke_restored.txt"); then
  echo "PASS — restored DB matches prod."
  RC=0
else
  echo "FAIL — diffs above."
  RC=1
fi

echo
echo "=== timing ==="
cat "$TIMING"

# ── 7. Tear down (always; container is cheap to recreate) ──────────────────
docker rm -f "$CONTAINER" >/dev/null
echo
echo "Drill artifacts retained at: $DRILL_DIR"
echo "Container '$CONTAINER' removed."
exit $RC
