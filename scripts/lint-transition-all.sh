#!/usr/bin/env bash
# transition-all lint — counts uses of `transition-all` in app surfaces.
# Fails if the count exceeds the baseline in `.transition-baseline.txt`.
#
# `transition-all` paints every animatable property and is the leading
# cause of jank and unintended hover transitions. List the properties
# explicitly: `transition-[background-color,box-shadow,transform]`,
# `transition-colors`, `transition-opacity`, etc.
#
# To ratchet the baseline DOWN after fixing violations:
#   1. Run this script
#   2. Copy the printed count into .transition-baseline.txt
#   3. Commit the new baseline alongside the cleanup
#
# Scope (same as other ratcheting lints): app surfaces only.

set -e

BASELINE_FILE="$(dirname "$0")/../.transition-baseline.txt"
BASELINE=0
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
fi

count_violations() {
  grep -rEoh "\btransition-all\b" \
    src/app/\(dashboard\) \
    src/app/\(fullscreen\) \
    src/app/\(auth\) \
    src/app/\(squeeze\) \
    src/components/ui \
    src/components/coach \
    src/components/session \
    --include="*.tsx" \
    --include="*.ts" \
    --include="*.css" \
    --exclude-dir="__tests__" \
    2>/dev/null \
    | wc -l \
    | tr -d ' '
}

CURRENT=$(count_violations)

if [ "$CURRENT" -gt "$BASELINE" ]; then
  echo "❌ transition lint: $CURRENT \`transition-all\` uses (baseline: $BASELINE)"
  echo ""
  echo "Replace with explicit property lists. See design-system.md §Visual Doctrine."
  exit 1
fi

if [ "$CURRENT" -lt "$BASELINE" ]; then
  echo "✓ transition lint: $CURRENT \`transition-all\` uses (baseline: $BASELINE — ratchet down to $CURRENT)"
else
  echo "✓ transition lint: $CURRENT \`transition-all\` uses (matches baseline)"
fi
