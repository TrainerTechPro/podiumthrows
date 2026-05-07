#!/usr/bin/env bash
# ─── Hybrid Deploy ───────────────────────────────────────────────────
# Preview: builds locally and ships prebuilt output (fast, ~$0 build cost).
# Prod:    lets Vercel cloud-build on its own Linux runtime so native
#          bindings (Prisma engines, bcrypt native, etc.) always match
#          the target architecture. Eliminates the darwin→linux mismatch
#          class of bug that caused the 2026-04-13 outage.
#
# Both modes run preflight (tsc + lint), prisma migrate deploy, and a
# post-deploy smoke test against /api/auth/login (prod only; preview
# URLs are SSO-gated).
#
# Usage:
#   ./scripts/deploy.sh           # preview deployment (prebuilt)
#   ./scripts/deploy.sh prod      # production deployment (Vercel cloud build)
#
# Requirements:
#   - Vercel CLI: npm i -g vercel
#   - Vercel project linked: vercel link
# ─────────────────────────────────────────────────────────────────────

set -uo pipefail

PROD_MODE=false
if [[ "${1:-}" == "prod" || "${1:-}" == "production" ]]; then
  PROD_MODE=true
  echo "🚀 Production deploy (Vercel cloud build — Linux native)"
else
  echo "🔍 Preview deploy (local prebuilt)"
fi

# ── Step 1: Pre-flight checks ──────────────────────────────────────
echo ""
echo "── Pre-flight checks ──"

echo -n "  TypeScript... "
if ! npx tsc --noEmit 2>/dev/null; then
  echo "❌ FAILED"
  echo "Fix type errors before deploying."
  exit 1
fi
echo "✓"

echo -n "  Lint... "
LINT_OUTPUT=$(npx next lint 2>&1)
if ! echo "$LINT_OUTPUT" | grep -q "No ESLint warnings or errors"; then
  echo "❌ FAILED"
  echo "$LINT_OUTPUT" | tail -5
  exit 1
fi
echo "✓"

# ── Step 2: Pull env vars from Vercel ──────────────────────────────
echo ""
echo "── Pulling environment variables ──"
npx vercel env pull .env.vercel.local --yes 2>/dev/null || true

# Source the env file for the build (prisma migrate deploy needs DB URL)
if [[ -f .env.vercel.local ]]; then
  set -a
  source .env.vercel.local
  set +a
  echo "  ✓ Loaded .env.vercel.local"
else
  echo "  ⚠ No .env.vercel.local — using existing env vars"
fi

# ── Step 3: Run migrations against production DB ───────────────────
# Fast-fail locally rather than waiting for Vercel build to discover a
# migration error. Vercel will re-run migrate deploy during cloud build;
# it's idempotent.
echo ""
echo "── Running migrations ──"
npx prisma migrate deploy
echo "  ✓ Migrations applied"

# ── Step 4: Generate Prisma client (preview only) ──────────────────
# Prod skips this — Vercel's cloud build runs `prisma generate` on
# Linux via the postinstall hook, producing a native Linux engine
# that actually matches the runtime. That's the whole point of
# cloud-building prod: no cross-platform native binary drift.
if ! $PROD_MODE; then
  echo ""
  echo "── Generating Prisma client ──"
  npx prisma generate
  echo "  ✓ Client generated"
fi

# ── Step 5: Pull project settings if needed ────────────────────────
if [[ ! -f .vercel/project.json ]]; then
  echo ""
  echo "── Pulling Vercel project settings ──"
  npx vercel pull --yes --environment production
fi

# ── Step 6: Build (preview only) ───────────────────────────────────
# Prod lets Vercel build in the cloud on a Linux runtime.
if ! $PROD_MODE; then
  echo ""
  echo "── Building locally (vercel build) ──"
  npx vercel build 2>&1 | tail -5
  echo "  ✓ Build complete"
fi

# ── Step 7: Deploy ─────────────────────────────────────────────────
echo ""
if $PROD_MODE; then
  echo "── Deploying to Vercel (cloud build) ──"
  npx vercel deploy --prod
else
  echo "── Deploying to Vercel (prebuilt) ──"
  npx vercel deploy --prebuilt
fi
DEPLOY_EXIT=$?

if [[ $DEPLOY_EXIT -ne 0 ]]; then
  echo "❌ Deploy failed (exit $DEPLOY_EXIT)"
  exit $DEPLOY_EXIT
fi

# ── Step 8: Smoke tests (prod only) ────────────────────────────────
# Two probes, both auto-rollback on failure:
#   1. Auth API — POST /api/auth/login with bad creds expects 401. Catches
#      platform-specific bundle failures (e.g. native binary mismatch) that
#      Vercel's build succeeds on but runtime 500s. Prior incident:
#      2026-04-13 Prisma engine mismatch (darwin-arm64 vs linux-arm64) 500'd
#      every Prisma-backed route for 2+ days before detection.
#   2. Route smoke — public pages return 200 and a few protected routes
#      still resolve to the right /login?redirect=… URL. Catches page-level
#      regressions the auth probe is blind to. Prior incident: 2026-05-07
#      /changelog and /terms 307'd unauthenticated visitors to /login (PR
#      #70) — the auth probe was green throughout.
if $PROD_MODE; then
  SMOKE_URL="https://www.podiumthrows.com"
  VERCEL_SCOPE="tonys-projects-9cce8202"

  rollback_and_exit() {
    echo ""
    echo "── Auto-rollback ──"
    npx vercel rollback --scope "$VERCEL_SCOPE" --yes 2>&1 | tail -5
    echo ""
    echo "❌ Deploy rolled back due to smoke test failure."
    echo "   Check Vercel logs for the failing deployment and fix before redeploying."
    exit 1
  }

  echo ""
  echo "── Smoke test: auth API ──"

  CSRF=$(curl -sS -D - "$SMOKE_URL/login" -o /dev/null 2>&1 \
    | grep -i "set-cookie: csrf-token=" \
    | sed 's/.*csrf-token=\([^;]*\).*/\1/' \
    | tr -d '\r\n')

  if [[ -z "$CSRF" ]]; then
    echo "  ⚠ Could not fetch CSRF token from $SMOKE_URL/login — skipping auth probe"
  else
    STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
      -X POST "$SMOKE_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -b "csrf-token=$CSRF" \
      -H "x-csrf-token: $CSRF" \
      -d '{"email":"smoke-test-deploy@example.com","password":"invalid-password"}' \
      2>/dev/null)

    if [[ "$STATUS" == "401" ]]; then
      echo "  ✓ Login 401 for bad creds — Prisma/bcrypt/rate-limit paths all healthy"
    else
      echo "  ❌ /api/auth/login returned $STATUS, expected 401"
      rollback_and_exit
    fi
  fi

  echo ""
  echo "── Smoke test: routes ──"

  ROUTE_FAILURES=()

  # Public/marketing pages — must render directly, not 307 to /login.
  # The 2026-05-07 regression slipped /changelog and /terms out of the
  # middleware allowlist; both 307'd to /login until PR #70 restored them.
  for path in "/" "/pricing" "/privacy" "/changelog" "/terms"; do
    STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$SMOKE_URL$path" 2>/dev/null)
    if [[ "$STATUS" == "200" ]]; then
      echo "  ✓ 200 $path"
    else
      echo "  ❌ $path returned $STATUS (expected 200)"
      ROUTE_FAILURES+=("$path: $STATUS, want 200")
    fi
  done

  # Protected routes: follow the chain (next.config redirect → middleware
  # auth redirect) and confirm we land on /login with the right ?redirect=.
  # Doubles as a check that next.config redirects survived the deploy.
  REDIRECT_CHECKS=(
    "/coach/throws/analyze|/login?redirect=%2Fcoach%2Fvideo-analysis"
    "/coach/schedule/print|/login?redirect=%2Fcoach%2Fcalendar%2Fprint"
    "/coach/settings/notifications|/login?redirect=%2Fcoach%2Fsettings"
  )
  for entry in "${REDIRECT_CHECKS[@]}"; do
    path="${entry%%|*}"
    expected="${entry#*|}"
    FINAL=$(curl -sSL -o /dev/null -w "%{url_effective}" --max-time 10 "$SMOKE_URL$path" 2>/dev/null)
    if [[ "$FINAL" == *"$expected"* ]]; then
      echo "  ✓ $path → …$expected"
    else
      echo "  ❌ $path resolved to $FINAL"
      ROUTE_FAILURES+=("$path: $FINAL, want substring $expected")
    fi
  done

  if (( ${#ROUTE_FAILURES[@]} > 0 )); then
    echo ""
    echo "  ${#ROUTE_FAILURES[@]} route smoke failure(s):"
    for f in "${ROUTE_FAILURES[@]}"; do
      echo "    - $f"
    done
    rollback_and_exit
  fi
fi

echo ""
if $PROD_MODE; then
  echo "✅ Production deploy complete — smoke tests passed."
else
  echo "✅ Preview deploy complete — zero Vercel build minutes used."
fi
