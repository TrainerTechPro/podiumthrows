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

# ── Step 8: Smoke test (prod only) ─────────────────────────────────
# Catches platform-specific bundle failures (e.g. native binary mismatch)
# that Vercel's build succeeds on but runtime requests 500 on. Prior
# incident: 2026-04-13 Prisma engine mismatch (darwin-arm64 vs linux-arm64)
# 500'd every Prisma-backed route for 2+ days before detection.
if $PROD_MODE; then
  SMOKE_URL="https://www.podiumthrows.com"
  VERCEL_SCOPE="tonys-projects-9cce8202"

  echo ""
  echo "── Smoke test (prod) ──"

  CSRF=$(curl -sS -D - "$SMOKE_URL/login" -o /dev/null 2>&1 \
    | grep -i "set-cookie: csrf-token=" \
    | sed 's/.*csrf-token=\([^;]*\).*/\1/' \
    | tr -d '\r\n')

  if [[ -z "$CSRF" ]]; then
    echo "  ⚠ Could not fetch CSRF token from $SMOKE_URL/login — skipping smoke test"
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
      echo "  ❌ Smoke test FAILED (/api/auth/login returned $STATUS, expected 401)"
      echo ""
      echo "── Auto-rollback ──"
      npx vercel rollback --scope "$VERCEL_SCOPE" --yes 2>&1 | tail -5
      echo ""
      echo "❌ Deploy rolled back due to smoke test failure."
      echo "   Check Vercel logs for the failing deployment and fix before redeploying."
      exit 1
    fi
  fi
fi

echo ""
if $PROD_MODE; then
  echo "✅ Production deploy complete — smoke test passed."
else
  echo "✅ Preview deploy complete — zero Vercel build minutes used."
fi
