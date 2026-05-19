#!/usr/bin/env bash
# focus-suppression lint — counts `focus:outline-none` without a matching
# `focus-visible:` ring in app surfaces. Pairs lint failures with WCAG
# 2.4.7 Focus Visible.
#
# The pattern is: any `focus:outline-none` should be `focus-visible:outline-none`
# (the modern way to suppress the native outline only for non-keyboard focus),
# AND should always be paired with `focus-visible:ring-*` to supply an
# alternative focus indicator.
#
# This lint only counts `focus:outline-none` — the unconditional suppressor.
# `focus-visible:outline-none` is correct usage when paired with a ring.
#
# To ratchet the baseline DOWN: fix sites, then update `.focus-baseline.txt`.

set -e

BASELINE_FILE="$(dirname "$0")/../.focus-baseline.txt"
BASELINE=0
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(cat "$BASELINE_FILE")
fi

count_violations() {
  grep -rEoh "\bfocus:outline-none\b" \
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
  echo "❌ focus-suppress lint: $CURRENT \`focus:outline-none\` uses (baseline: $BASELINE)"
  echo ""
  echo "Use \`focus-visible:outline-none\` paired with \`focus-visible:ring-*\` instead."
  exit 1
fi

if [ "$CURRENT" -lt "$BASELINE" ]; then
  echo "✓ focus-suppress lint: $CURRENT \`focus:outline-none\` uses (baseline: $BASELINE — ratchet down to $CURRENT)"
else
  echo "✓ focus-suppress lint: $CURRENT \`focus:outline-none\` uses (matches baseline)"
fi
