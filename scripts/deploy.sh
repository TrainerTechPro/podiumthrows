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

# ── Step 3.5: Seed catalog tables (upsert-only, prod-safe) ─────────
# Catalog tables (implements, performance-test types) are NOT touched by
# `prisma migrate deploy`. They were historically reseeded only by the
# dev seed (which wipes data), so new catalog rows never reached prod and
# features shipped EMPTY (implements + perf-tests, 2026-04-30). These two
# standalone scripts are upsert-only — no deleteMany — so they're safe to
# run against prod on every deploy and produce zero diff when unchanged.
echo ""
echo "── Seeding catalog tables (idempotent) ──"
npx tsx scripts/seed-implements.ts
npx tsx scripts/seed-performance-test-types.ts
echo "  ✓ Catalog seeds applied"

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
# --archive=tgz: the project exceeds Vercel CLI's 15000-file upload cap
# (node_modules + generated assets push us past 23k). tgz packs the
# upload before transit. Cloud-build side unpacks unchanged.
echo ""
if $PROD_MODE; then
  echo "── Deploying to Vercel (cloud build) ──"
  npx vercel deploy --prod --archive=tgz
else
  echo "── Deploying to Vercel (prebuilt) ──"
  npx vercel deploy --prebuilt --archive=tgz
fi
DEPLOY_EXIT=$?

if [[ $DEPLOY_EXIT -ne 0 ]]; then
  echo "❌ Deploy failed (exit $DEPLOY_EXIT)"
  exit $DEPLOY_EXIT
fi

# ── Step 8: Smoke tests (prod only) ────────────────────────────────
# Three probes, all funnel into the same auto-rollback path on failure:
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
#   3. Authenticated smoke — logs in as smoke+monitor@ (COACH) and
#     smoke+athlete@ (ATHLETE) and GETs ~13 representative dashboard
#     surfaces. Catches the "200 with broken envelope" class that PR #68
#     fixed for /coach/settings/notifications — anything past the auth
#     boundary that 500s, page-errors, or renders the Next.js error page
#     trips the rollback. Skipped silently if SMOKE_PASSWORD is unset
#     (per-machine convenience for fresh checkouts).
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
  echo "── Smoke test: health ──"
  # /api/health pings the DB (SELECT 1) and 503s if it's unreachable. First
  # probe because a DB-down condition makes every subsequent probe a red
  # herring — fail fast and roll back on the clearest possible signal.
  HEALTH_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$SMOKE_URL/api/health" 2>/dev/null)
  if [[ "$HEALTH_STATUS" == "200" ]]; then
    echo "  ✓ /api/health 200 — DB reachable"
  else
    echo "  ❌ /api/health returned $HEALTH_STATUS, expected 200"
    rollback_and_exit
  fi

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
  #
  # /coach/throws/analyze chain: next.config 308 → /coach/video-analysis,
  # then middleware sees video-analysis is FLAG_GATED (PR #124) and
  # short-circuits to /coach/dashboard before the unauth /login bounce.
  # Final destination is /login?redirect=%2Fcoach%2Fdashboard. The probe
  # still validates the next.config redirect fires — the chain wouldn't
  # reach the flag-gate at all if the 308 was broken.
  REDIRECT_CHECKS=(
    "/coach/throws/analyze|/login?redirect=%2Fcoach%2Fdashboard"
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

  echo ""
  echo "── Smoke test: authenticated ──"

  if [[ -z "${SMOKE_PASSWORD:-}" ]]; then
    echo "  ⚠ SMOKE_PASSWORD not set in env — skipping auth'd smoke"
    echo "    (set SMOKE_PASSWORD + SMOKE_COACH_EMAIL + SMOKE_ATHLETE_EMAIL"
    echo "     in Vercel Production env, then re-pull with vercel env pull)"
  else
    SMOKE_COACH_EMAIL="${SMOKE_COACH_EMAIL:-smoke+monitor@podiumthrows.com}"
    SMOKE_ATHLETE_EMAIL="${SMOKE_ATHLETE_EMAIL:-smoke+athlete@podiumthrows.com}"
    AUTH_FAILURES=()

    # Returns 0 and prints the auth-token cookie value on success, or 1 on
    # any login failure. Uses a per-call cookie jar so the two role probes
    # don't cross-contaminate sessions.
    auth_login() {
      local email="$1" jar="$2"
      curl -sS -c "$jar" "$SMOKE_URL/login" -o /dev/null --max-time 10 2>/dev/null
      local csrf
      csrf=$(grep -E '^[^#].*csrf-token' "$jar" | awk '{print $7}' | tail -1)
      if [[ -z "$csrf" ]]; then
        echo "no-csrf"
        return 1
      fi
      local code
      code=$(curl -sS -b "$jar" -c "$jar" -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$SMOKE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -H "x-csrf-token: $csrf" \
        -d "{\"email\":\"$email\",\"password\":\"$SMOKE_PASSWORD\"}" \
        2>/dev/null)
      if [[ "$code" != "200" ]]; then
        echo "login-$code"
        return 1
      fi
      return 0
    }

    # GETs path with the auth cookie jar; appends to AUTH_FAILURES on any
    # non-200 OR if the body contains a Next.js error-page sentinel. We
    # can't see runtime React errors without a headless browser, but the
    # error-page strings catch RSC/SSR throws and digest-tagged 500s.
    auth_probe() {
      local jar="$1" path="$2"
      local body_file
      body_file=$(mktemp)
      local code
      code=$(curl -sS -b "$jar" -o "$body_file" -w "%{http_code}" --max-time 10 \
        "$SMOKE_URL$path" 2>/dev/null)
      if [[ "$code" != "200" ]]; then
        echo "  ❌ $path → $code"
        AUTH_FAILURES+=("$path: $code")
      elif grep -qiE "Application error|Something went wrong|__NEXT_DATA__.*\"err\"" "$body_file"; then
        echo "  ❌ $path → 200 but rendered error page"
        AUTH_FAILURES+=("$path: error-page sentinel matched")
      else
        echo "  ✓ 200 $path"
      fi
      rm -f "$body_file"
    }

    COACH_JAR=$(mktemp)
    if ! auth_login "$SMOKE_COACH_EMAIL" "$COACH_JAR"; then
      echo "  ❌ Coach login failed for $SMOKE_COACH_EMAIL"
      AUTH_FAILURES+=("coach login failed")
    else
      echo "  ✓ Coach logged in: $SMOKE_COACH_EMAIL"
      # /coach/throws bare path 308s to /coach/dashboard; the former
      # /coach/throws/profile probe was retired with PR #125 — its jobs
      # were absorbed by /coach/athletes/[id] (already covered by the
      # /coach/athletes probe below).
      #
      # FLAG_GATED routes (src/middleware.ts) are intentionally NOT probed
      # here. When their flag is off middleware 307s to /coach/dashboard,
      # tripping the auth_probe 200-expectation as a false positive even
      # though the deploy itself is healthy. The /coach/* gates today are:
      # video-analysis, videos, architect, sideline, throws/practice,
      # questionnaires. If you need coverage of one, gate the probe on
      # the flag's state — don't just add the URL back.
      for path in \
        "/coach/dashboard" \
        "/coach/athletes" \
        "/coach/calendar" \
        "/coach/library" \
        "/coach/settings" \
        "/coach/settings?tab=notifications"; do
        auth_probe "$COACH_JAR" "$path"
      done
    fi
    rm -f "$COACH_JAR"

    ATHLETE_JAR=$(mktemp)
    if ! auth_login "$SMOKE_ATHLETE_EMAIL" "$ATHLETE_JAR"; then
      echo "  ❌ Athlete login failed for $SMOKE_ATHLETE_EMAIL"
      AUTH_FAILURES+=("athlete login failed")
    else
      echo "  ✓ Athlete logged in: $SMOKE_ATHLETE_EMAIL"
      # /athlete/sessions hosts the Training Hub component. /athlete/throws/trends
      # is FLAG_GATED (throwsAnalysis) so it's deliberately omitted — see the
      # comment in the coach block for the rationale. /athlete/* gates today
      # also include self-program, oura, whoop, questionnaires.
      for path in \
        "/athlete/dashboard" \
        "/athlete/log-session" \
        "/athlete/sessions" \
        "/athlete/settings"; do
        auth_probe "$ATHLETE_JAR" "$path"
      done
    fi
    rm -f "$ATHLETE_JAR"

    if (( ${#AUTH_FAILURES[@]} > 0 )); then
      echo ""
      echo "  ${#AUTH_FAILURES[@]} auth'd smoke failure(s):"
      for f in "${AUTH_FAILURES[@]}"; do
        echo "    - $f"
      done
      rollback_and_exit
    fi
  fi
fi

echo ""
if $PROD_MODE; then
  echo "✅ Production deploy complete — smoke tests passed."
else
  echo "✅ Preview deploy complete — zero Vercel build minutes used."
fi
