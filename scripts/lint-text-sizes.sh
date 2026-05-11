#!/usr/bin/env bash
# Text-size lint — counts uses of bracketed text-[Npx] in app surfaces.
# Fails if the count exceeds the baseline in `.text-size-baseline.txt`.
#
# Use the `text-nano` / `text-micro` / `text-caption` / `text-body` tokens
# defined in `tailwind.config.ts`. Floor is 10px (text-nano). Anything
# below 10px is an accessibility violation (WCAG 1.4.4 Resize Text).
#
# To ratchet the baseline DOWN after fixing violations:
#   1. Run this script
#   2. Copy the printed count into .text-size-baseline.txt
#   3. Commit the new baseline alongside the cleanup
#
# Scope (in-scope = app UI surfaces):
#   - src/app/(dashboard)
#   - src/app/(fullscreen)
#   - src/app/(auth)
#   - src/app/(squeeze)
#   - src/components/ui
#   - src/components/coach
#   - src/components/session
#
# Out of scope (allowlist):
#   - src/components/marketing/** (own editorial register)
#   - tests, marketing, OG image, etc.

set -e

BASELINE_FILE="$(dirname "$0")/../.text-size-baseline.txt"
BASELINE=0
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
fi

count_violations() {
  grep -rEoh "text-\[[0-9]+(\.[0-9]+)?px\]" \
    src/app/\(dashboard\) \
    src/app/\(fullscreen\) \
    src/app/\(auth\) \
    src/app/\(squeeze\) \
    src/components/ui \
    src/components/coach \
    src/components/session \
    --include="*.tsx" \
    --include="*.ts" \
    --exclude-dir="__tests__" \
    2>/dev/null \
    | wc -l \
    | tr -d ' '
}

CURRENT=$(count_violations)

if [ "$CURRENT" -gt "$BASELINE" ]; then
  echo "❌ text-size lint: $CURRENT bracketed text-[Npx] in app surfaces (baseline: $BASELINE)"
  echo ""
  echo "New bracketed text sizes introduced. Use design tokens instead:"
  echo "  text-nano    — 10–11px (status badges, pill labels only)"
  echo "  text-micro   — 11–12px (dense labels, overlines)"
  echo "  text-caption — 13px    (captions, secondary text)"
  echo "  text-body    — 15px    (body)"
  echo ""
  echo "Floor is 10px. Anything below is a WCAG 1.4.4 violation."
  echo ""
  echo "Top violating files:"
  grep -rlE "text-\[[0-9]+(\.[0-9]+)?px\]" \
    src/app/\(dashboard\) \
    src/app/\(fullscreen\) \
    src/app/\(auth\) \
    src/app/\(squeeze\) \
    src/components/ui \
    src/components/coach \
    src/components/session \
    --include="*.tsx" \
    --include="*.ts" \
    --exclude-dir="__tests__" \
    2>/dev/null \
    | head -10
  exit 1
fi

if [ "$CURRENT" -lt "$BASELINE" ]; then
  echo "✓ text-size lint: $CURRENT bracketed sizes (baseline: $BASELINE — you can ratchet down to $CURRENT)"
else
  echo "✓ text-size lint: $CURRENT bracketed sizes (matches baseline)"
fi
