#!/usr/bin/env bash
# Hex-literal lint — counts uses of #RRGGBB / #RRGGBBAA in app surfaces.
# Fails if the count exceeds the baseline in `.hex-baseline.txt`.
#
# Use design tokens instead of hex. See CLAUDE.md §Design System Rules.
#
# To ratchet the baseline DOWN after fixing violations:
#   1. Run this script
#   2. Copy the printed count into .hex-baseline.txt
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
#   - tailwind.config.ts      (token definitions)
#   - src/app/globals.css     (token definitions)
#   - src/lib/design-tokens.ts (canvas/SVG hex constants — intentional)
#   - src/lib/email*.ts        (email HTML inline styles — clients don't read CSS vars)
#   - src/app/api/og/**        (server-rendered OG image)
#   - src/app/api/leads/**     (email HTML)
#   - src/app/api/recap/**     (email HTML)
#   - src/components/marketing/** (always-dark editorial register — own decision)
#   - src/components/video-analysis/** (event domain colors)
#   - src/components/ui/PlateCalculator.tsx (IPF plate colors)

set -e

BASELINE_FILE="$(dirname "$0")/../.hex-baseline.txt"
BASELINE=0
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
fi

# Count hex literals in scope, excluding the allowlist.
count_violations() {
  grep -rEoh "#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?" \
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
    --exclude="PlateCalculator.tsx" \
    2>/dev/null \
    | wc -l \
    | tr -d ' '
}

CURRENT=$(count_violations)

if [ "$CURRENT" -gt "$BASELINE" ]; then
  echo "❌ hex-literal lint: $CURRENT hex literals in app surfaces (baseline: $BASELINE)"
  echo ""
  echo "New hex literals introduced. Use design tokens instead. See CLAUDE.md §Design System Rules."
  echo ""
  echo "Top violating files:"
  grep -rlE "#[0-9a-fA-F]{6}" \
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
    --exclude="PlateCalculator.tsx" \
    2>/dev/null \
    | head -10
  exit 1
fi

if [ "$CURRENT" -lt "$BASELINE" ]; then
  echo "✓ hex-literal lint: $CURRENT hex literals (baseline: $BASELINE — you can ratchet down to $CURRENT)"
else
  echo "✓ hex-literal lint: $CURRENT hex literals (matches baseline)"
fi
