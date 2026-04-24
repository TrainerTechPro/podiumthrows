# Route Consolidation — PR 1 Execution Plan

**Branch:** `refactor/route-consolidation-pr1` (to be created)
**Target:** `main`
**Mode:** PLAN (CLAUDE-standards.md §Development Mode Protocol + Refactoring Protocol)
**Status:** DRAFT — awaiting user approval before MODE: EXECUTE.

**Companion doc:** `tasks/route-consolidation-manifest.md` (canonical-surface picks + per-route validation notes).

**File-location note:** `tasks/todo.md` is currently occupied by a stale Video Analysis plan from March 27 (feature already shipped per `prisma/schema.prisma::model VideoAnalysis`). This plan is written to `tasks/route-consolidation-todo.md` to avoid silent overwrite. User can decide to (a) move this into `tasks/todo.md` after confirming the video-analysis doc is archivable, (b) leave as-is.

---

## 0. Safety rails

Before any commit on `main` or before starting this branch:

```bash
git fetch origin
git log HEAD..origin/main --oneline
```

If the remote has commits we don't, stop and reconcile per `feedback_parallel_terminal_git_race.md`.

**Non-negotiable constraints (CLAUDE.md + user prompt):**

- No `prisma db push`. PR 1 is route-only; schema changes land in PR 2.
- Every deleted route gets a 307 redirect (new rules) OR is already shadowed by the existing 308 redirects in `next.config.mjs` (file-only delete).
- No new UI dependencies. Custom components only.
- No Bondarchuk rule violations (PR 1 shouldn't touch `src/lib/bondarchuk/` at all — if it does, stop and replan).
- Verification gates per step: `npm run typecheck && npm run lint && npm run test && npm run build` all green.

---

## 1. Commit sequence (atomic, rollback-first)

Order: redirects land FIRST, so every deletion has a safety net before we cut.

### Commit 1 — `refactor(routes): add 307 redirects ahead of route consolidation`

Edit `next.config.mjs`. Inside the existing `async redirects() { return [ ... ] }` array, append the new rules. Keep existing `permanent: true` rules untouched — they represent real prior IA consolidations.

```js
// Page-level redirect stubs promoted to config (preserve bookmarks).
{ source: '/athlete/hub',       destination: '/athlete/dashboard',          permanent: false },
{ source: '/coach/my-program',  destination: '/athlete/dashboard',          permanent: false },
{ source: '/coach/my-training', destination: '/athlete/dashboard',          permanent: false },
{ source: '/coach/my-lifting',  destination: '/athlete/dashboard',          permanent: false },
{ source: '/coach/drill-videos',destination: '/coach/throws/drills',        permanent: false },
{ source: '/coach/invitations', destination: '/coach/athletes/invitations', permanent: false },

// Near-dead consumer-log URLs folded into the canonical log surface.
{ source: '/athlete/throws/log', destination: '/athlete/log-session',       permanent: false },
// Post-validation only — include this ONLY if Commit 4 validation confirms quick-start has no
// server-side or email-template entry.
{ source: '/athlete/quick-start', destination: '/athlete/log-session',      permanent: false },
```

**Why this commit first:** the redirects shadow the existing `page.tsx` files (config redirects run before file-system routing). With redirects in place, every following deletion is a no-op from the client's perspective. This is the rollback point — if any downstream commit goes sideways, revert to this SHA and the app still routes correctly.

**Verification before commit:**

```bash
npm run typecheck && npm run lint && npm run build
# Local dev smoke: start dev, hit each new source path in a browser, confirm 307.
```

### Commit 2 — `refactor(routes): delete session-detail files shadowed by existing redirects`

Pure file deletion. All 6 pages are already shadowed by `permanent: true` rules shipped earlier in `next.config.mjs` (see manifest §1).

```bash
rm src/app/(dashboard)/athlete/sessions/[id]/page.tsx
rm src/app/(dashboard)/athlete/sessions/[id]/recap/page.tsx
rm src/app/(dashboard)/athlete/sessions/assignment/[id]/page.tsx
rm src/app/(dashboard)/athlete/throws/session/[id]/page.tsx
rm src/app/(dashboard)/athlete/throws/live/[assignmentId]/page.tsx
rm src/app/(dashboard)/coach/athletes/[id]/sessions/[assignmentId]/page.tsx
```

**Before delete — per-directory check:**
For each directory above, run `grep -rn "/<source-path>" src/` to confirm no runtime code still constructs these URLs as template literals. Our grep pass says none do, but double-check. Also inspect each directory with `ls` and remove any co-located files that only served the deleted page (`loading.tsx`, `_components/*`, etc.).

**After delete — verify:**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
# Manual browser check: hit /athlete/sessions/some-id; expect 308 → /athlete/session/some-id.
```

### Commit 3 — `refactor(routes): delete page-level redirect stubs (moved to config)`

Pure file deletion. Commit 1 moved their behavior into `next.config.mjs` as 307s.

```bash
rm src/app/(dashboard)/athlete/hub/page.tsx
rm src/app/(dashboard)/coach/drill-videos/page.tsx
rm src/app/(dashboard)/coach/invitations/page.tsx
rm src/app/(dashboard)/coach/my-program/page.tsx
rm src/app/(dashboard)/coach/my-training/page.tsx
rm src/app/(dashboard)/coach/my-lifting/page.tsx
```

**Verify:** the config redirect now services each path. Browser-check each source URL.

### Commit 4 — `refactor(routes): consolidate /athlete/throws/log into /athlete/log-session`

1. Grep for `"/athlete/throws/log"` in `src/`. The only current static reference is inside `src/app/(dashboard)/athlete/throws/page.tsx`.
2. Rewrite that `<Link href="/athlete/throws/log">` to `href="/athlete/log-session"`.
3. In `src/components/ui/Sidebar.tsx`, remove `/athlete/throws/log` from the `ATHLETE_NAV_SECTIONS` Throws parent's `matchPaths`.
4. `rm src/app/(dashboard)/athlete/throws/log/page.tsx` (and any co-located `_*.tsx` that only served it).
5. Verify: Commit 1's 307 catches any remaining traffic.

### Commit 5 — `refactor(routes): validate + consolidate /athlete/quick-start`

1. Read `src/app/(dashboard)/athlete/quick-start/page.tsx`. Confirm it's a tutorial/empty shell and NOT a server-side-redirect target.
2. `grep -rn "quick-start" src/` to confirm no API or email template links to it. First-pass grep shows only the BottomTabBar matchPaths reference.
3. If confirmed dead:
   - In `src/components/layout/BottomTabBar.tsx`, remove `/athlete/quick-start` from the Log tab `matchPaths`.
   - `rm src/app/(dashboard)/athlete/quick-start/page.tsx` (and any co-located files).
   - Confirm the 307 added in Commit 1 still routes the URL to `/athlete/log-session`.
4. If NOT dead (the page has non-trivial content or is server-referenced): revert the 307 added in Commit 1 in a follow-up commit, remove this commit from the plan, leave the page alone.

### Commit 6 — `refactor(routes): narrow /coach/hub matchPaths`

In `src/components/ui/Sidebar.tsx::COACH_NAV_SECTIONS`:

- Remove `/coach/hub` from the **Athletes parent's** `matchPaths` array. It belongs only to the "Team Hub" child, which already has `matchPaths: ["/coach/hub"]`.
- Leave the "Team Hub" child entry intact — `/coach/hub` remains a live page.

### Commit 7 (ONLY after user decision) — `refactor(routes): handle 6 validation-gated routes`

Do not execute this commit without explicit user approval on each route. Per §Refactoring Protocol, this is the checkpoint step:

**Per-route questions the user needs to answer:**

1. **`/coach/session/[id]`** — Renders a `TrainingSession` (lift session). Zero inbound. Options:
   - **(A)** Wire `<Link href={\`/coach/session/${session.id}\`}>` from the session list on `/coach/athletes/[id]`. Keep page.
   - **(B)** Redirect to a newly-built `/coach/athletes/[id]/sessions/[trainingSessionId]` (structurally unified with how `ThrowsAssignment` is addressed).
   - **(C)** Delete the page and the `TrainingSession` detail surface (acknowledge regression, track in PR backlog).
2. **`/coach/throws/programming`** — Exercise recommender. Zero inbound. Options:
   - **(A)** Wire a Link from `/coach/plans/generate` (keep).
   - **(B)** 307 → `/coach/plans/generate`; delete.
3. **`/coach/codex`** — `/athlete/codex` imports `CodexView` from this directory. Options:
   - **(A)** Move `_codex-client.tsx` to `src/components/codex/`; 307 → TBD; delete the coach route page.
   - **(B)** Keep the coach codex page as a coach-accessible reader; wire sidebar entry.
4. **`/coach/feedback-inbox`** — Zero inbound. Read before deciding. Likely (B): 307 → `/coach/notifications`.
5. **`/coach/athlete-logs`** — Zero inbound. Read before deciding. Likely (B): 307 → `/coach/athletes`.
6. **`/coach/settings/security`** — Zero inbound at first pass; confirm `/coach/settings/page.tsx` doesn't link to a nested security tab. If dead, 307 → `/coach/settings`.

For each route the user decides to delete, add the 307 to `next.config.mjs` in the **same commit** as the file deletion.

### Commit 8 — `refactor(routes): dead-code pass for deleted-route consumers`

Run:

```bash
npx ts-prune > /tmp/ts-prune.out
# Also: git grep for any exported symbol defined only inside the deleted pages' _components.
```

Eyeball every ts-prune result. Do NOT trust the tool blindly — private components that only served deleted pages can be removed; shared components that just happen to have lost their last consumer stay put.

Remove any `_component.tsx` that (a) lived inside a deleted page's directory and (b) is imported by nothing else.

### Commit 9 — `refactor(routes): log consolidation to Notion + Decision Log`

Per CLAUDE.md §Notion Activity Logging:

- One Activity Log entry per commit group (Category: Refactor, Impact: High). Reference the commit SHAs.
- One Decision Log entry (`91ba4b7b-d8f2-4307-bfff-13397d85f529`) capturing the canonical-surface picks for each of the 5 ambiguous surfaces and the rationale.
- When the PR merges, one Release Log entry (`360602a3-6352-4561-9977-1913eb644acb`) with the commit range `HEAD..main` and links to the Activity Log entries.

---

## 2. Redirect rules in full (delta to `next.config.mjs`)

Insert the block below inside the existing `async redirects() { return [ ... ] }` array, **before** the existing `permanent: true` rules (purely for readability — ordering doesn't affect behavior).

```js
// ── PR 1: route-consolidation 307s ──────────────────────────────────────
// Page-level redirect stubs promoted to config.
{ source: '/athlete/hub',         destination: '/athlete/dashboard',           permanent: false },
{ source: '/coach/my-program',    destination: '/athlete/dashboard',           permanent: false },
{ source: '/coach/my-training',   destination: '/athlete/dashboard',           permanent: false },
{ source: '/coach/my-lifting',    destination: '/athlete/dashboard',           permanent: false },
{ source: '/coach/drill-videos',  destination: '/coach/throws/drills',         permanent: false },
{ source: '/coach/invitations',   destination: '/coach/athletes/invitations',  permanent: false },
// Near-dead consumer-log URLs folded into the canonical log surface.
{ source: '/athlete/throws/log',  destination: '/athlete/log-session',         permanent: false },
// Conditional on Commit 5 validation:
{ source: '/athlete/quick-start', destination: '/athlete/log-session',         permanent: false },
```

All new rules use `permanent: false` (307) per the user spec. Existing `permanent: true` rules stay unchanged — they're real IA migrations, not cleanup.

---

## 3. Navigation-config diffs

### `src/components/ui/Sidebar.tsx`

**Diff 1 — remove `/coach/hub` from the Athletes parent `matchPaths`:**

```diff
      {
        label: "Athletes",
        href: "/coach/athletes",
        icon: <Users {...iconSize} />,
        matchPaths: [
          "/coach/athletes",
          "/coach/invitations",
          "/coach/competitions",
          "/coach/availability",
          "/coach/team",
          "/coach/practices",
-         "/coach/hub",
          "/coach/teams",
          "/coach/event-groups",
          "/coach/goals",
        ],
```

**Diff 2 — remove `/athlete/throws/log` from `ATHLETE_NAV_SECTIONS` Throws matchPaths:**

```diff
      {
        label: "Throws",
        href: "/athlete/throws",
        icon: <Target {...iconSize} />,
        matchPaths: [
          "/athlete/throws",
-         "/athlete/throws/log",
          "/athlete/throws/history",
          "/athlete/throws/session",
          "/athlete/throws/trends",
          "/athlete/throws/readiness",
          "/athlete/achievements",
          "/athlete/competitions",
        ],
```

### `src/components/layout/BottomTabBar.tsx`

**Diff 3 — remove `/athlete/quick-start` from Log tab matchPaths (only after Commit 5 validation confirms the page is dead):**

```diff
  {
    href: "/athlete/log-session",
    label: "Log",
    icon: PlusCircle,
    primary: true,
-   matchPaths: ["/athlete/log-session", "/athlete/quick-start"],
+   matchPaths: ["/athlete/log-session"],
  },
```

No change to the five-tab count (hard constraint).

---

## 4. Verification plan

### Per-commit automated

Run after every commit:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

### Per-redirect smoke test (manual, pre-merge)

For each new redirect, confirm with:

```bash
curl -sI -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  http://localhost:3000/<old-path>
```

Expected rows:

```
307 /athlete/dashboard                              # /athlete/hub
307 /athlete/dashboard                              # /coach/my-program
307 /athlete/dashboard                              # /coach/my-training
307 /athlete/dashboard                              # /coach/my-lifting
307 /coach/throws/drills                            # /coach/drill-videos
307 /coach/athletes/invitations                     # /coach/invitations
307 /athlete/log-session                            # /athlete/throws/log
307 /athlete/log-session                            # /athlete/quick-start (if Commit 5 landed)
# Existing 308s — sanity-check they still work:
308 /athlete/session/some-id                        # /athlete/sessions/some-id
308 /athlete/throws/some-id                         # /athlete/sessions/assignment/some-id
308 /athlete/throws/some-id                         # /athlete/throws/session/some-id
308 /athlete/throws/some-id?view=live               # /athlete/throws/live/some-id
308 /coach/throws/some-id?athlete=some-athlete-id   # /coach/athletes/some-athlete-id/sessions/some-id
```

### Playwright spec (optional, ship if time permits)

`tests/e2e/route-consolidation.spec.ts` — one `test()` per redirect, asserting `response.status() === 307` and the final URL. Keep it fast (<5s total) by not following the redirect chain into real page renders. Mark it `test.describe.serial` so any one failure halts the rest — there's no parallel isolation needed.

### Canonical-surface screenshots (PR description)

Before the PR lands, open each canonical surface in both themes, both products, and paste screenshots into the PR description:

- `/athlete/dashboard` (light + dark)
- `/athlete/log-session` (light + dark)
- `/athlete/self-program` (light + dark)
- `/athlete/throws` (light + dark)
- `/athlete/profile` (light + dark)
- `/coach/dashboard` (light + dark)
- `/coach/plans` (light + dark)
- `/coach/schedule` (light + dark)
- `/coach/athletes` (light + dark)
- `/coach/hub` (light + dark) — Team Hub, not a duplicate

### Count check in PR description

```bash
find src/app/\(dashboard\) -name page.tsx | wc -l
```

Target: drops from 117 → 103 (14 deletions) or 117 → 97 if all 6 validation-gated routes are also deleted.

---

## 5. Rollback strategy

Each commit is a clean revert target:

- **Revert Commit 2 or 3** → reintroduces the deleted files; the config redirects from Commit 1 still route correctly (the deleted pages were shadowed anyway). No user-visible change.
- **Revert Commit 1** → removes the new config redirects. Page-stub files from Commit 3 are already deleted, so those paths now return raw 404 until Commit 3 is also reverted. Therefore: if Commit 1 is reverted, Commit 3 must be reverted too. Script the pair revert as `git revert <c3>..<c1>`.
- **Revert Commit 4/5** → re-add the deleted page; redo the pointing Link rewrites manually.
- **Revert Commit 6** → trivial, just restores matchPaths.

If a fire hits production and we can't cleanly revert:

1. Re-enable deleted pages by adding minimal `redirect()` stubs at the original paths that point at the canonical targets. Ship as a hotfix.
2. Do this BEFORE `git revert` — the stubs resolve the 404 instantly even if the revert is non-trivial due to subsequent commits layering on top.

---

## 6. Acceptance checklist (PR description)

- [ ] `npm run typecheck` green
- [ ] `npm run lint` green
- [ ] `npm run test` green
- [ ] `npm run build` green
- [ ] All new 307s return the expected destination (curl grid above)
- [ ] All existing 308s still return the expected destination (regression check)
- [ ] `find src/app/\(dashboard\) -name page.tsx | wc -l` dropped by ≥14
- [ ] Screenshots of all 10 canonical surfaces pasted in PR description (light + dark)
- [ ] Coach sidebar renders correctly on all surviving pages (no dead matchPaths)
- [ ] BottomTabBar stays at 5 tabs, Log anchor is `/athlete/log-session`
- [ ] Activity Log entry + Decision Log entry created in Notion
- [ ] No `prisma db push`, no new UI deps, no Bondarchuk rule touched
- [ ] `git fetch origin && git log HEAD..origin/main --oneline` clean before merge

---

## 7. Open questions for the user (answer before MODE: EXECUTE)

1. **`/coach/session/[id]`** — A/B/C per §1 Commit 7? (recommend **A**: wire Links from the athlete detail page.)
2. **`/coach/throws/programming`** — A/B per §1 Commit 7? (recommend **B**: 307 + delete unless a demo reveals unique value.)
3. **`/coach/codex`** — A/B per §1 Commit 7? (recommend **A** only if the CodexView component is used elsewhere; otherwise **B** keeps the route small.)
4. **`/coach/feedback-inbox`, `/coach/athlete-logs`, `/coach/settings/security`** — OK to inspect-and-decide during Commit 7, without blocking approval on these three up front?
5. **`/athlete/quick-start`** — OK to include its 307 in Commit 1 and the deletion in Commit 5, contingent on the Commit 5 validation? (Alternative: split into a follow-up PR.)
6. **Playwright route-consolidation spec** — ship in this PR, or defer?
7. **`tasks/todo.md` vs `tasks/route-consolidation-todo.md`** — OK to leave this plan in the second file, or move it to `tasks/todo.md` and archive the stale video-analysis plan?

**Stop point:** do not begin MODE: EXECUTE until the user has:

- Reviewed and approved this plan.
- Answered questions 1–7 (or deferred the validation-gated ones to Commit 7 per §1).
- Confirmed the branch name and the commit-grouping strategy.
