#!/usr/bin/env bash
# ─── Prebuilt Deploy ─────────────────────────────────────────────────
# Builds locally and deploys to Vercel WITHOUT using Vercel build minutes.
#
# Usage:
#   ./scripts/deploy.sh           # preview deployment
#   ./scripts/deploy.sh prod      # production deployment
#
# Requirements:
#   - Vercel CLI: npm i -g vercel
#   - Vercel project linked: vercel link
#   - Environment variables pulled: vercel env pull .env.vercel.local
#
# This saves ~$0.27 per deploy ($72/mo → ~$0 at current build volume).
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

PROD_FLAG=""
if [[ "${1:-}" == "prod" || "${1:-}" == "production" ]]; then
  PROD_FLAG="--prod"
  echo "🚀 Production deploy"
else
  echo "🔍 Preview deploy"
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
LINT_OUTPUT=$(npx next lint 2>&1 | tail -1)
if echo "$LINT_OUTPUT" | grep -q "error"; then
  echo "❌ FAILED"
  echo "$LINT_OUTPUT"
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
echo ""
echo "── Running migrations ──"
npx prisma migrate deploy
echo "  ✓ Migrations applied"

# ── Step 4: Generate Prisma client ─────────────────────────────────
echo ""
echo "── Generating Prisma client ──"
npx prisma generate
echo "  ✓ Client generated"

# ── Step 5: Build locally ──────────────────────────────────────────
echo ""
echo "── Building Next.js locally ──"
npx next build
echo "  ✓ Build complete"

# ── Step 6: Deploy prebuilt output ─────────────────────────────────
echo ""
echo "── Deploying to Vercel (prebuilt) ──"
npx vercel deploy --prebuilt $PROD_FLAG

echo ""
echo "✅ Deploy complete — zero Vercel build minutes used."
