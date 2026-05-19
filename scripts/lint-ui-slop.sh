#!/usr/bin/env bash
# UI-slop lint — hard 0-baseline gate. Fails on generic SaaS phrases and
# the rendering anti-patterns called out in CLAUDE.md §Design System Rules
# §Overlay surfaces.
#
# This is intentionally NOT a ratcheting lint. These patterns either
# don't exist in the codebase or were nuked in the 2026-05-19 microcopy
# sweep (commit ae5732e). Re-introducing them should hard-fail CI.
#
# Implementation note: uses `grep -rE` (not ripgrep) so it works in any
# subshell whose PATH may not include /opt/homebrew/bin. The earlier
# `rg`-based version silently passed in `bash -c` contexts.
#
# Scope: same app surfaces as the other lints — no marketing, no tests.

set -e

SCOPE_DIRS=(
  'src/app/(dashboard)'
  'src/app/(fullscreen)'
  'src/app/(auth)'
  'src/app/(squeeze)'
  src/components/ui
  src/components/coach
  src/components/session
  src/components/insights
  src/components/throws
  src/components/competitions
  src/components/form-renderer
  src/components/form-blocks
  src/components/form-builder
  src/components/notifications
  src/components/pwa
  src/components/video
  src/components/charts
)

# Each entry: "<label>|<extended-regex>".
# Patterns are fed to `grep -rE`; escape regex metacharacters appropriately.
PATTERNS=(
  # Anti-patterns nuked in the 2026-05-19 microcopy sweep:
  'Generic "Something went wrong"|Something went wrong'
  'Dev-speak "Failed to <verb>"|"Failed to [a-z]'
  'Generic "An unexpected error occurred"|"An unexpected error occurred"'
  'Generic showError\("Error",\) toast|showError\("Error",'

  # Three-period verb labels — any "<Verb>ing..." (quoted or unquoted JSX
  # text) is a regression. The 2026-05-19 sweep converted these to the
  # ellipsis character. Catches Loading, Saving, Submitting, Verifying,
  # Creating, Activating, Uploading, Deleting, Sending, Recomputing,
  # Generating, Regenerating, Starting, Resuming, Assigning, Applying,
  # Logging, Trimming, Capturing, Removing, Disabling, Adding, Dismissing,
  # Cloning, Revoking, Updating, Fetching, Processing, Setting up,
  # Extracting, Looking up.
  #
  # Match shape: capitalized verb word, then 0-40 non-quote/non-tag chars,
  # then 3 ASCII dots. Catches both `"Saving draft..."` and JSX text like
  # `>Generating...<`. Excludes JS spread (no capital verb before ...) and
  # `...rest` parameters.
  'Three-period verb label (use ellipsis character …)|\b(Loading|Saving|Submitting|Verifying|Creating|Activating|Uploading|Deleting|Sending|Recomputing|Generating|Regenerating|Starting|Resuming|Assigning|Applying|Logging|Trimming|Capturing|Removing|Disabling|Adding|Dismissing|Cloning|Revoking|Updating|Fetching|Processing|Setting up|Extracting|Looking up)[^"<>\n]{0,40}\.\.\.'

  # Bare loading-state ellipsis as the entire visible text: `"..."` or `>...<`.
  # Standalone three-dot placeholders (no verb in front) are still slop —
  # show "…" or "Saving…" or a spinner-only state instead.
  'Bare three-dot placeholder text — use "…" or a spinner|"\.\.\."|>\s*\.\.\.\s*<'

  # Bare "Submit" / "Submit Responses" / "Slide to Submit" — name the
  # action (e.g. "Save Responses", "Slide to Finish Session"). Allowed:
  # the word "Submit" inside aria-labels (less visual prominence),
  # docstrings, code comments, and event handlers (handleSubmit, onSubmit,
  # etc). This pattern targets JSX text and visible string literals only.
  'Bare "Submit"/"Submit Responses"/"Slide to Submit" — name the action|>(Submit|Submit Responses)<|"(Submit|Submit Responses)"|Slide to Submit'

  # Generic "No data" empty text — say what is missing instead
  # ("No throws logged yet", "Awaiting check-in", etc.). Matches both
  # quoted ("No data...") and JSX text (>No data<) variants. The justified
  # chart internal in src/components/charts/LineChart.tsx was renamed to
  # "Nothing to chart yet" before this lint shipped; if a future chart
  # genuinely needs to render the literal "No data", document it inline
  # and rename to a contextual phrase.
  'Generic "No data" empty text — say what is missing|"No [Dd]ata\b|>\s*No [Dd]ata\b'

  # CLAUDE.md §Overlay surfaces forbids translucent content surfaces.
  # Backdrop-blur on a content panel = invisible content in dark mode.
  # Allowed: backdrop-blur on backdrop scrims behind modals (currently
  # zero in scope; would need a comment-tagged exception if introduced).
  'backdrop-blur on content surface (CLAUDE.md §Overlay surfaces forbids)|backdrop-blur'
)

FAIL=0

for entry in "${PATTERNS[@]}"; do
  label="${entry%%|*}"
  pattern="${entry#*|}"
  hits=$(grep -rEln "$pattern" "${SCOPE_DIRS[@]}" \
    --include="*.tsx" --include="*.ts" \
    --exclude-dir=__tests__ \
    2>/dev/null || true)
  count=$(printf "%s" "$hits" | grep -c . || true)
  if [ "$count" -gt 0 ]; then
    echo ""
    echo "❌ $label"
    echo "   pattern: $pattern"
    echo "   $count file(s) violate:"
    grep -rEn "$pattern" "${SCOPE_DIRS[@]}" \
      --include="*.tsx" --include="*.ts" \
      --exclude-dir=__tests__ \
      2>/dev/null | head -10
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "✅ ui-slop lint: 0 violations across ${#PATTERNS[@]} patterns"
else
  echo ""
  echo "See CLAUDE.md §Design System Rules and the 2026-05-19 microcopy sweep"
  echo "(commit ae5732e) for the voice + token rules these patterns violate."
  exit 1
fi
