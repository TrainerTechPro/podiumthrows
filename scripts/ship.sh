#!/usr/bin/env bash
# ship.sh — open a feat/* PR with auto-merge enabled.
#
# Usage:
#   scripts/ship.sh "<branch slug>" "<PR title>"
#
# Behavior:
#   1. Verifies you're on main with no uncommitted changes (refuses otherwise).
#   2. Pulls latest main.
#   3. Creates feat/<slug> branch.
#   4. (You commit your work on this branch — script PAUSES if there's nothing
#      to push, prompting you to commit first.)
#   5. Pushes the branch.
#   6. Opens a PR with `gh pr create`.
#   7. Enables auto-merge (squash) so it lands as soon as CI passes.
#
# Why: the harness blocks direct pushes to main; CI on PR is the gate. Without
# this script, every change requires a 7-step dance. With it, one command.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: scripts/ship.sh <branch-slug> <pr-title>" >&2
  echo 'Example: scripts/ship.sh fix-empty-state "fix: empty state on quiet weeks"' >&2
  exit 1
fi

slug="$1"
title="$2"
branch="feat/${slug}"

# Sanity: clean tree, on main
current=$(git rev-parse --abbrev-ref HEAD)
if [ "$current" != "main" ]; then
  echo "✗ Not on main (current: $current). Switch to main first." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Uncommitted changes on main. Commit or stash before running ship.sh." >&2
  git status --short >&2
  exit 1
fi

echo "▸ pull main"
git fetch origin
git pull --ff-only origin main

# Check branch doesn't already exist
if git show-ref --verify --quiet "refs/heads/${branch}"; then
  echo "✗ Branch ${branch} already exists locally. Pick a different slug or delete it first." >&2
  exit 1
fi

echo "▸ create branch ${branch}"
git checkout -b "${branch}"

echo ""
echo "─────────────────────────────────────────────────────────"
echo "  Branch ${branch} ready. Now make your commits, then"
echo "  hit ENTER to push + open the PR. Ctrl-C to abort."
echo "─────────────────────────────────────────────────────────"
read -r

# Verify there's actually something to push (commits ahead of main)
ahead=$(git rev-list --count "main..${branch}")
if [ "$ahead" -eq 0 ]; then
  echo "✗ No commits on ${branch} yet. Commit something first, then re-run." >&2
  exit 1
fi

echo "▸ push ${branch} (typecheck + lint via husky)"
git push -u origin "${branch}"

echo "▸ open PR"
pr_url=$(gh pr create --title "${title}" --body "$(cat <<EOF
## Summary

(fill in or edit before merge)

## Test plan

- [ ] CI green
- [ ] Manual smoke if relevant

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)")

echo "▸ enable auto-merge (squash)"
gh pr merge "${pr_url}" --auto --squash

echo ""
echo "✓ PR open with auto-merge: ${pr_url}"
echo "  CI will run, then it'll land + delete the branch automatically."
