#!/usr/bin/env bash
# Raw-palette lint — counts uses of default Tailwind color palettes
# (amber/emerald/red/gray/slate/zinc/stone/orange/sky/indigo/purple/pink/lime/
#  fuchsia/teal/cyan/violet/rose) in app surfaces.
# Fails if the count exceeds the baseline in `.palette-baseline.txt`.
#
# Use project tokens instead:
#   - amber → primary-* (project gold #FFC800, NOT Tailwind amber #fbbf24)
#   - emerald / green → success-* / status-success-fg
#   - red → danger-* / status-danger-fg
#   - gray / slate / zinc / stone → surface-* / text token (--color-text-*)
#   - other rainbow palettes have no place in default product surfaces
#
# To ratchet the baseline DOWN after fixing violations:
#   1. Run this script
#   2. Copy the printed count into .palette-baseline.txt
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
#   - src/components/video-analysis/** (event domain colors)
#   - src/components/ui/PlateCalculator.tsx (IPF plate colors)
#   - tests, OG images, email templates

set -e

BASELINE_FILE="$(dirname "$0")/../.palette-baseline.txt"
BASELINE=0
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
fi

count_violations() {
  grep -rEoh "(text|bg|border|ring|from|to|via|placeholder|fill|stroke|caret|accent|decoration|outline|divide)-(amber|emerald|red|gray|slate|zinc|stone|orange|sky|indigo|purple|pink|lime|fuchsia|teal|cyan|violet|rose)-[0-9]+(/[0-9]+)?" \
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
  echo "❌ palette lint: $CURRENT raw-Tailwind palette uses in app surfaces (baseline: $BASELINE)"
  echo ""
  echo "Use project tokens (primary-*, success-*, danger-*, surface-*, --color-text-*)"
  echo "instead of default Tailwind palettes. See design-system.md §Visual Doctrine."
  echo ""
  echo "Top violating files:"
  grep -rlE "(text|bg|border|ring)-(amber|emerald|red|gray|slate|zinc|stone|orange)-[0-9]" \
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
  echo "✓ palette lint: $CURRENT raw-palette uses (baseline: $BASELINE — you can ratchet down to $CURRENT)"
else
  echo "✓ palette lint: $CURRENT raw-palette uses (matches baseline)"
fi
