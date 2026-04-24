# Route Consolidation Manifest — PR 1

**Generated:** 2026-04-23
**Mode:** RESEARCH (CLAUDE-standards.md §Development Mode Protocol)
**Scope:** every `page.tsx` under `src/app/(dashboard)/coach` and `src/app/(dashboard)/athlete`.
**Totals:** coach = 69 pages, athlete = 48 pages, 117 total.

---

## 0. Verification note — DO NOT TREAT FIRST-PASS ORPHAN LIST AS FINAL

A first-pass subagent grep counted static `<Link href="/coach/...">` hits. It **missed template-literal hrefs** and `router.push(\`/coach/.../${id}\`)` patterns. Follow-up grep confirmed **false positives** on the subagent list:

- `/coach/throws/profile`, `/coach/throws/profile/typing` — reached via `\`/coach/throws/profile?athleteId=${id}\`` from four files.
- `/coach/log-session` — referenced in `DashboardLayout.tsx` (FOCUS_MODE_PREFIXES) and `QuickActions.tsx`.
- `/coach/invitations` — already a 1-line `redirect("/coach/athletes/invitations")` stub.
- `/coach/hub` — real "Team Hub" page reached via Sidebar entry "Team Hub".
- `/coach/session/[id]` — real page (renders a `TrainingSession` detail) but unreferenced.
- `/athlete/review-profile` — reached via `/api/auth/register-claim/route.ts` server-side redirect.
- `/athlete/hub` — already a 1-line `redirect("/athlete/dashboard")` stub with a comment noting it's kept for bookmark preservation.
- `/athlete/insights`, `/athlete/achievements`, `/athlete/codex`, `/athlete/videos`, `/athlete/drill-videos`, `/athlete/assessments` — reached via `/athlete/profile/page.tsx` nav array and `QuickActions.tsx`.
- `/coach/competitions`, `/coach/athletes/[id]/profile/edit`, `/coach/athletes/[id]/sessions/[assignmentId]` — reached via template literals from multiple files.
- `/coach/goals`, `/coach/availability`, `/coach/event-groups`, `/coach/team`, `/coach/teams`, `/coach/exercises`, `/coach/notifications`, `/coach/schedule` — sidebar entries (actual live links, not just matchPaths).
- `/athlete/achievements`, `/athlete/notifications`, `/athlete/profile`, `/athlete/team`, `/athlete/tools`, `/athlete/videos/[id]`, `/athlete/whoop`, `/athlete/oura` — reached via BottomTabBar, profile nav, QuickActions, or integration callbacks.

Every route in §2–3 below has been **revalidated** with both double-quote-literal AND template-literal grep before being placed in a bucket. Any route still called "orphan" here is a genuine zero-reference page.

---

## 1. Existing redirect infrastructure (already in place)

### Config-level redirects in `next.config.mjs` (all `permanent: true` → 308)

These were shipped in prior IA consolidations. The `page.tsx` files at the source paths **still exist in the tree but are shadowed** by Next.js route matching (config redirects run before file-system routing). Deleting these files is pure file cleanup — no new redirect needed.

| Source                                       | Destination                                             | Status                                            |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| `/athlete/throws/analysis`                   | `/athlete/throws/trends`                                | 308 active. No `page.tsx` exists at source.       |
| `/athlete/throws/profile`                    | `/athlete/throws/readiness`                             | 308 active. No `page.tsx` exists at source.       |
| `/coach/throws/roster`                       | `/coach/athletes?tab=throws&moved=1`                    | 308 active. No `page.tsx` exists at source.       |
| `/coach/programming`                         | `/coach/schedule`                                       | 308 active. No `page.tsx` exists at source.       |
| `/coach/programming/:path*`                  | `/coach/schedule/:path*`                                | 308 active.                                       |
| `/coach/sessions`                            | `/coach/plans`                                          | 308 active.                                       |
| `/coach/sessions/new`                        | `/coach/plans/new`                                      | 308 active.                                       |
| `/coach/throws/program-builder`              | `/coach/plans/generate`                                 | 308 active. No `page.tsx` exists at source.       |
| `/athlete/sessions/:id`                      | `/athlete/session/:id`                                  | 308 active. **`page.tsx` exists — dead, delete.** |
| `/athlete/sessions/:id/recap`                | `/athlete/session/:id?view=recap`                       | 308 active. **`page.tsx` exists — dead, delete.** |
| `/athlete/sessions/assignment/:id`           | `/athlete/throws/:id`                                   | 308 active. **`page.tsx` exists — dead, delete.** |
| `/athlete/throws/session/:id`                | `/athlete/throws/:id`                                   | 308 active. **`page.tsx` exists — dead, delete.** |
| `/athlete/throws/live/:id`                   | `/athlete/throws/:id?view=live`                         | 308 active. **`page.tsx` exists — dead, delete.** |
| `/coach/athletes/:athleteId/sessions/:id`    | `/coach/throws/:id?athlete=:athleteId`                  | 308 active. **`page.tsx` exists — dead, delete.** |

### Page-level `redirect()` stubs (in-tree)

One-liner `redirect(...)` page.tsx files. Preserve bookmarks but belong in `next.config.mjs` for consistency.

| File                                                           | Current behavior                            | Consolidation action (PR 1)                                                      |
| -------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/(dashboard)/athlete/hub/page.tsx`                     | `redirect("/athlete/dashboard")`            | Move to next.config.mjs as 307, delete file.                                     |
| `src/app/(dashboard)/coach/drill-videos/page.tsx`              | `redirect("/coach/throws/drills")`          | Move to next.config.mjs as 307, delete file.                                     |
| `src/app/(dashboard)/coach/invitations/page.tsx`               | `redirect("/coach/athletes/invitations")`   | Move to next.config.mjs as 307, delete file. Leave Sidebar entry intact (still resolves). |
| `src/app/(dashboard)/coach/my-program/page.tsx`                | `redirect("/athlete/dashboard")`            | Move to next.config.mjs as 307, delete file.                                     |
| `src/app/(dashboard)/coach/my-training/page.tsx`               | `redirect("/athlete/dashboard")`            | Move to next.config.mjs as 307, delete file.                                     |
| `src/app/(dashboard)/coach/my-lifting/page.tsx`                | `redirect("/athlete/dashboard")`            | Move to next.config.mjs as 307, delete file.                                     |

---

## 2. Canonical-surface decisions

The user named five ambiguous surfaces. Per §Dual Product Identity (athlete = mobile-primary consumer, coach = desktop research-software), canonical picks are:

### 2.1 Dashboard

| Role    | Canonical                                      | Rationale |
| ------- | ---------------------------------------------- | --------- |
| Athlete | **`/athlete/dashboard`** (25 inbound links; BottomTabBar Home anchor; middleware login redirect target) | The mobile-primary consumer home. Everything ladders to this. |
| Coach   | **`/coach/dashboard`** (12 inbound links; middleware login redirect target)                              | The desktop back-office home. |

**`/coach/hub`** is **not** a duplicate — it's the Team Hub (announcements, team files, team links) and is Sidebar-reached. Keep it. Narrow its matchPaths to `["/coach/hub"]` (currently listed inside the Athletes parent matchPaths, which is wrong).

**`/athlete/hub`** is a redirect stub → move to config + delete file.

### 2.2 Programming surface

| Role    | Canonical                   | Rationale |
| ------- | --------------------------- | --------- |
| Athlete | **`/athlete/self-program`** (9 inbound) + **`/athlete/sessions`** (Training tab, 6 inbound) | Training tab = coach-assigned sessions. Self-program = athlete-created. Two surfaces, two intents, both canonical. |
| Coach   | **`/coach/plans`** (6 inbound; plan templates) + **`/coach/schedule`** (scheduled instances) | Already consolidated in prior H-2 shipment (see existing next.config redirects). `plans` = templates, `schedule` = weekly calendar. |

**Kill (redirect + delete):**
- `/coach/my-program`, `/coach/my-training`, `/coach/my-lifting` — already `redirect()` stubs, move to config and delete files.
- `/coach/throws/programming` — real page (exercise recommender) but zero inbound. This surface appears subsumed by `/coach/plans/generate`. **Per-route validation required before action:** read the page, compare functionality to `/coach/plans/generate`. If duplicate, 307 → `/coach/plans/generate`. If distinct functionality, keep and wire a Link from `/coach/plans` or `/coach/throws`.

### 2.3 Session detail

Already consolidated via existing next.config 308s. The remaining `page.tsx` files at the old paths are **shadowed dead code**. Delete files; existing redirects continue to serve.

**Kill (delete files only — redirects already in place):**
- `src/app/(dashboard)/athlete/sessions/[id]/page.tsx`
- `src/app/(dashboard)/athlete/sessions/[id]/recap/page.tsx`
- `src/app/(dashboard)/athlete/sessions/assignment/[id]/page.tsx`
- `src/app/(dashboard)/athlete/throws/session/[id]/page.tsx`
- `src/app/(dashboard)/athlete/throws/live/[assignmentId]/page.tsx`
- `src/app/(dashboard)/coach/athletes/[id]/sessions/[assignmentId]/page.tsx`

**Canonical per role:**
- Coach session-detail → **`/coach/throws/[id]?athlete=:athleteId`** (throws-unified view; existing target of the sessions/[id] redirect).
- Athlete program session → **`/athlete/session/[id]`** (distinct from throws).
- Athlete throw detail → **`/athlete/throws/[id]`** (with `?view=live|recap` variants).

**`/coach/session/[id]`** is distinct: it renders a `TrainingSession` (lift workout). It is **unreferenced but functional** and is NOT the same as `/coach/throws/[id]` (`ThrowsAssignment`). **Per-route validation required:** decide whether to keep (wire inbound Links from `/coach/athletes/[id]` session lists) or redirect to a coach view of the athlete-sessions-view nested path. Flagging for user decision — do not delete in PR 1 without confirmation.

### 2.4 Onboarding

| Role    | Canonical                                                                 | Rationale |
| ------- | ------------------------------------------------------------------------- | --------- |
| Coach   | **`/coach/onboarding/welcome`** (reached by register/route.ts + stripe checkout success URL + email template) | Keep. |
| Athlete | **`/athlete/onboarding`** (middleware flag-gated) + **`/athlete/review-profile`** (reached by register-claim/route.ts for claimed invitees) | Two paths, one per entry type. Keep both. |

**Kill:**
- `/athlete/quick-start` — zero inbound. BottomTabBar only registers it in `matchPaths` (cosmetic, not an active link). **Per-route validation required:** read the page, confirm it's not a tutorial the app directs to programmatically. If truly dead, 307 → `/athlete/log-session` and delete.

### 2.5 Log page

| Role    | Canonical                   | Rationale |
| ------- | --------------------------- | --------- |
| Athlete | **`/athlete/log-session`** (7 inbound; BottomTabBar primary "Log" anchor; FOCUS_MODE_PREFIXES entry) | Thumb-zone primary action. The app ladders to this moment. |
| Coach   | **`/coach/log-session`** (referenced from DashboardLayout FOCUS_MODE_PREFIXES, QuickActions) — **NOT an orphan**                       | Keep. |

**Kill:**
- `/athlete/throws/log` — 1 inbound link from `/athlete/throws/page.tsx`. Rewrite that link to point at `/athlete/log-session`; add 307 → `/athlete/log-session`; delete file. Remove `/athlete/throws/log` from Sidebar `ATHLETE_NAV_SECTIONS` matchPaths.

---

## 3. Candidates for PR 1 deletion (with validation gates)

### Confirmed dead (safe to act, subject to confirming nothing dynamic points here):

**Shadowed-by-config (delete file only):**
1. `src/app/(dashboard)/athlete/sessions/[id]/page.tsx`
2. `src/app/(dashboard)/athlete/sessions/[id]/recap/page.tsx`
3. `src/app/(dashboard)/athlete/sessions/assignment/[id]/page.tsx`
4. `src/app/(dashboard)/athlete/throws/session/[id]/page.tsx`
5. `src/app/(dashboard)/athlete/throws/live/[assignmentId]/page.tsx`
6. `src/app/(dashboard)/coach/athletes/[id]/sessions/[assignmentId]/page.tsx`

**Page-stub-to-config (move redirect, delete file):**

7. `src/app/(dashboard)/athlete/hub/page.tsx`
8. `src/app/(dashboard)/coach/drill-videos/page.tsx`
9. `src/app/(dashboard)/coach/invitations/page.tsx`
10. `src/app/(dashboard)/coach/my-program/page.tsx`
11. `src/app/(dashboard)/coach/my-training/page.tsx`
12. `src/app/(dashboard)/coach/my-lifting/page.tsx`

**Near-dead (rewrite inbound, add 307, delete):**

13. `src/app/(dashboard)/athlete/throws/log/page.tsx` (one inbound Link to rewrite in `athlete/throws/page.tsx`)
14. `src/app/(dashboard)/athlete/quick-start/page.tsx` (zero real inbound — confirm by reading it first)

### Requires user decision (do NOT delete in PR 1 without confirmation):

- **`/coach/session/[id]`** — distinct `TrainingSession` renderer with no callers. Options: (a) wire Links from `/coach/athletes/[id]` lift-session lists, (b) 307 → `/coach/throws/[id]` (wrong semantics — different model), (c) delete and accept the regression until we build a replacement. Recommend (a).
- **`/coach/throws/programming`** — real "Exercise Recommender" page, zero inbound. Either (a) wire Link from `/coach/plans/generate` or `/coach/throws` and keep, (b) 307 → `/coach/plans/generate` if the features are truly duplicative.
- **`/coach/codex`** — inspect before acting. `/athlete/codex` imports `CodexView` from this directory, so the file cannot be deleted without refactoring the shared component out. Possibly a keeper as a component home even if the route is dead.
- **`/coach/feedback-inbox`** — zero inbound. Likely dead; confirm by reading what it renders.
- **`/coach/athlete-logs`** — zero inbound. Likely superseded by per-athlete view.
- **`/coach/settings/security`** — zero inbound at first pass. Verify `/coach/settings/page.tsx` doesn't link to a nested security page before removing.

### Confirmed live — remove from orphan list in the first-pass manifest:

- `/coach/team`, `/coach/teams`, `/coach/event-groups`, `/coach/goals`, `/coach/availability`, `/coach/competitions`, `/coach/competitions/[id]`, `/coach/exercises`, `/coach/integrations`, `/coach/notifications`, `/coach/schedule`, `/coach/schedule/print`, `/coach/throws/[id]`, `/coach/throws/profile`, `/coach/throws/profile/typing`, `/coach/athletes/[id]`, `/coach/athletes/[id]/profile/edit`, `/coach/video-analysis/[id]`, `/coach/videos/[id]`, `/coach/practices/[id]`, `/coach/plans/[planId]`, `/coach/questionnaires/[id]`, `/coach/questionnaires/[id]/responses`, `/coach/tools`, `/coach/wellness`, `/coach/log-session`.
- `/athlete/achievements`, `/athlete/assessments`, `/athlete/availability`, `/athlete/codex`, `/athlete/competitions/[id]`, `/athlete/drill-videos`, `/athlete/insights`, `/athlete/notifications`, `/athlete/oura`, `/athlete/profile`, `/athlete/questionnaires/[id]`, `/athlete/review-profile`, `/athlete/self-program/[id]`, `/athlete/self-program/[id]/session/[sessionId]`, `/athlete/session/[id]`, `/athlete/team`, `/athlete/throws/[id]`, `/athlete/tools`, `/athlete/videos/[id]`, `/athlete/whoop`.

---

## 4. Navigation-config state today

### Coach Sidebar — `src/components/ui/Sidebar.tsx::COACH_NAV_SECTIONS`

Canonical `href`s (all live or resolvable):

**Section 1 — primary:**
- Dashboard → `/coach/dashboard`
- Athletes (parent) → `/coach/athletes` with children: Roster, Throws, Groups, Event Groups, Goals, Invitations, Competitions, Availability, Practices, Team Feed, Team Hub
- Training (parent) → `/coach/throws` with children: Throws Hub, Schedule, Plans, Live Practice, Drill Library, Drills, Drill Builder, Exercises, Drill Videos
- Analyze (parent) → `/coach/video-analysis` with children: Pose Analysis, Questionnaires

**Section 2 — footer:**
- Notifications → `/coach/notifications`
- Settings → `/coach/settings`

### Athlete Sidebar — `ATHLETE_NAV_SECTIONS`

Exported from `Sidebar.tsx` but **not mounted in `AthleteShell`** (which uses `BottomTabBar` instead). Dead export unless used elsewhere — validation needed before touching.

### Bottom Tab Bar — `src/components/layout/BottomTabBar.tsx`

5 tabs, stays 5 tabs (hard constraint per §Dual Product Identity):

1. **Home** → `/athlete/dashboard`
2. **Training** → `/athlete/sessions` (matchPaths: `/athlete/self-program`)
3. **Log** (primary) → `/athlete/log-session` (matchPaths: `/athlete/quick-start`)
4. **Throws** → `/athlete/throws` (matchPaths: trends/history/readiness/quiz/session/live/achievements/competitions)
5. **Me** → `/athlete/profile` (matchPaths: settings/notifications/wellness/availability/team/integrations)

### Middleware redirects

- Authed user on `/` or `/login` → role-based dashboard
- Unauthed user on protected path → `/login?redirect=...`
- Non-coach on `/coach/*` → `/athlete/dashboard`
- Non-athlete on `/athlete/*` → `/coach/dashboard` (unless coach with activeMode=TRAINING)
- Feature-flag-gated prefix with flag off → role-based dashboard

---

## 5. Summary

- **Files to delete in PR 1 (candidates, pending per-route validation):** 14
  - 6 shadowed session-detail files (§1, redirects already live)
  - 6 redirect-stub files (§1, moving to config)
  - 1 near-dead page with 1 inbound to rewrite (`/athlete/throws/log`)
  - 1 suspected dead tutorial page (`/athlete/quick-start`) after confirmation
- **Files needing user decision before delete:** 5
  - `/coach/session/[id]`, `/coach/throws/programming`, `/coach/codex`, `/coach/feedback-inbox`, `/coach/athlete-logs`, `/coach/settings/security`
- **New config-level redirects to add to `next.config.mjs` (all `permanent: false` → 307):** 8
  - 6 routes moved from page-level `redirect()` stubs (§1)
  - `/athlete/throws/log` → `/athlete/log-session`
  - `/athlete/quick-start` → `/athlete/log-session` (if confirmed dead)
- **Sidebar config diff:**
  - Narrow `/coach/hub` matchPaths to exactly `["/coach/hub"]` (currently wrongly included in the Athletes parent matchPaths).
  - Remove `/athlete/throws/log` from `ATHLETE_NAV_SECTIONS` Throws matchPaths.
- **Bottom tab config diff:**
  - Remove `/athlete/quick-start` from Log tab matchPaths (after deletion).

**Zero breakage target:** every deleted route must either (a) be shadowed by an existing `next.config.mjs` redirect, (b) have a new `next.config.mjs` redirect added in the same commit, or (c) be a page-level `redirect()` stub whose target is moved to config in the same commit. No raw 404s.
