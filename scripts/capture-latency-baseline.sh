#!/usr/bin/env bash
# capture-latency-baseline.sh
#
# Samples `time_total` from curl against the eight PR 1 redirect-target
# routes on the production URL you pass in. Writes a JSON matching the
# shape in tasks/soak-baseline-example.json.
#
# Usage:
#   ./scripts/capture-latency-baseline.sh https://podiumthrows.com > baseline.json
#
# The JSON output is what you add as the PR1_LATENCY_BASELINE_JSON repo
# secret. The GitHub Action .github/workflows/pr1-soak-summary.yml reads
# that secret and diffs the post-deploy samples against the stored
# baseline, flagging any route whose median drifts >50ms.
#
# Samples 3 warm hits per route. These are single-client probes from
# wherever you run the script; not Vercel-reported p50/p95. That's
# acceptable for diff-based regression detection — the comparison stays
# apples-to-apples so long as both baseline and post-deploy captures
# come from the same host.

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <prod-url>" >&2
  echo "  e.g. $0 https://podiumthrows.com" >&2
  exit 2
fi

PROD_URL="$1"
case "$PROD_URL" in
  https://*) : ;;
  *) echo "Prod URL must start with https://" >&2; exit 2 ;;
esac

ROUTES=(
  /coach/dashboard
  /coach/plans
  /coach/schedule
  /coach/athletes
  /athlete/dashboard
  /athlete/throws
  /athlete/log-session
  /athlete/self-program
)

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Build the route → samples map via jq so quoting/escaping stays correct.
routes_json="{}"
for route in "${ROUTES[@]}"; do
  s1=$(curl -s -o /dev/null -w "%{time_total}" "$PROD_URL$route")
  s2=$(curl -s -o /dev/null -w "%{time_total}" "$PROD_URL$route")
  s3=$(curl -s -o /dev/null -w "%{time_total}" "$PROD_URL$route")
  routes_json=$(jq -nc \
    --argjson acc "$routes_json" \
    --arg path "$route" \
    --argjson s1 "$s1" \
    --argjson s2 "$s2" \
    --argjson s3 "$s3" \
    '$acc + {($path): {samples: [$s1, $s2, $s3]}}')
done

jq -n \
  --arg ts "$TIMESTAMP" \
  --arg url "$PROD_URL" \
  --argjson routes "$routes_json" \
  '{baseline_date: $ts, prod_url: $url, routes: $routes}'
