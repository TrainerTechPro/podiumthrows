# Throws History & Athlete Navigation Rework — Design Spec

**Date:** 2026-04-11
**Status:** Draft — pending user review
**Approach:** Throws Hub with five focused sub-pages (Option A from brainstorm), plus a scoped audit of the athlete-side navigation

---

## Problem

The `/athlete/throws` area has drifted into incoherence over several iterations, with multiple pages doing overlapping jobs and labels that don't match their destinations. The user's direct complaint:

> "The throws history page makes no sense. Buttons take you to a different page than what it's supposed to. Can we revamp the entire navigation system and make sure each clickable link leads to the right page that it's saying it's gonna go to."

**Concrete evidence of the breakage:**

1. The sidebar item labeled **"Throw History"** at `src/components/ui/Sidebar.tsx:410` points to `/athlete/throws` — but that page is titled **"Throws Practice"** and shows active/upcoming/past *assignments*, not a throws history.
2. The same page renders an action chip ALSO labeled **"Throw history"** at `src/app/(dashboard)/athlete/throws/page.tsx:206-211` that points to a *different* URL, `/athlete/throws/log` — and `/log` is the free-form logging form, not a history view either.
3. There is no page anywhere in the codebase that is genuinely "a chronological view of everything the athlete has thrown." The concept exists as a label but has no destination.
4. `/athlete/throws/page.tsx` mixes at least four distinct concerns: assigned session list, action chips for other pages, past sessions, and rest-day state. One page, four jobs.
5. `/athlete/throws/analysis` (distance trends) collides conceptually with the coach-side `/coach/video-analysis` — the word "analysis" is overloaded.
6. `/athlete/throws/profile` (readiness/podium profile) collides with `/athlete/profile` (the main account profile) — athletes click expecting their account and land on readiness scores.

**Root cause:** Features were added to the throws family page-by-page over time. Each new feature got its own route, but the labels and cross-links weren't updated to reflect the new structure. What was once "the throws page" became "the throws practice page plus mini-navigation plus a history chip that went nowhere plus a trends chart elsewhere."

## Goals

1. **One page, one purpose.** Every athlete-side throws page must answer exactly one question. If content doesn't fit the question, it moves.
2. **Build the missing history page.** A real `/athlete/throws/history` route that shows every throw the athlete has logged, in reverse chronological order, filterable.
3. **Every clickable link in the athlete side goes where it says it goes.** Run a structured audit over the athlete-side nav and every page in scope to find label/destination mismatches, dead links, duplicate labels, missing back buttons, wrong nesting, breadcrumb mismatches, and flow-endpoint issues. Fix them in a batched pass.
4. **Don't regress coach-side or non-athlete routes.** This work is scoped to the athlete side.
5. **Preserve existing URLs where possible via redirects.** Bookmarks and external links keep working forever.
6. **Mobile-first.** Every visual decision made with phone-width as the primary artifact. Desktop is a scale-up.
7. **Add a regression guard** so sidebar links can't silently break in the future.

## Non-Goals

- Coach-side nav or throws family rework (separate future project)
- Marketing site navigation
- Auth flow redesign
- Any change to the in-session workout player at `/athlete/throws/live/[assignmentId]`
- Training Hub redesign (recently shipped — out of scope per memory reference `project_training_hub.md`)
- Write-side consolidation of `ThrowLog` vs `ThrowsBlockLog` — the history page reads from both but does not refactor the tables
- Category G (page incoherence) findings *outside* the throws family — flagged in the audit findings doc but not fixed in this pass

---

## Section 1: Page Purposes

The core discipline of this rework is that each page answers one question. Content that doesn't fit the question moves elsewhere.

### 1.1 `/athlete/throws` → **Today**

- **Question it answers:** *"What should I do right now for my throwing training?"*
- **Shows:** today's assigned throwing session with a Start button; OR in-progress session with a Resume button; OR a clean "Rest day" state with a shortcut to Log a Throw for freestyle
- **Does NOT show:** history, trends, analysis chips, readiness scores, past sessions, any action-chip row
- **Replaces:** the current mashup at `src/app/(dashboard)/athlete/throws/page.tsx`
- **URL unchanged.** The route stays at `/athlete/throws`, but the page content is scoped down to the Today view only

### 1.2 `/athlete/throws/log` — scoped down

- **Question it answers:** *"I want to log a throw that wasn't part of an assigned session."*
- **Shows:** the free-form drill row builder (implement picker, drill type, throw count, best mark) — mostly already correct
- **Does NOT show:** trend charts, lists of previously-logged throws, anything presented as "history"
- **Fixes:** remove the trend chart widgets (`BestMarkChart`, `VolumeChart`) and any past-entries section from `_throw-log-form.tsx`; those move to Trends and History respectively

### 1.3 `/athlete/throws/history` — **NEW PAGE**

- **Question it answers:** *"Show me everything I've ever thrown, most recent first."*
- **Shows:** scrollable reverse-chronological timeline grouped by day, with filters (date range, event, implement weight, PR-only toggle)
- **Does NOT show:** charts (those are Trends), logging form (that's Log), readiness
- **See Section 3 for full design**

### 1.4 `/athlete/throws/trends` — renamed from `/athlete/throws/analysis`

- **Question it answers:** *"Am I getting better? Show me the numbers over time."*
- **Shows:** distance trend charts per event, PR records, comp-vs-practice split, implement comparison charts — already mostly built at `/analysis`
- **URL change:** `/analysis` → `/trends` via 301 redirect in `next.config.mjs`
- **Rename reason:** "Analysis" is vague AND collides with the coach's video-analysis feature

### 1.5 `/athlete/throws/readiness` — renamed from `/athlete/throws/profile`

- **Question it answers:** *"Am I ready to throw hard today? How's my body?"*
- **Shows:** readiness score, sleep/soreness/stress/energy breakdown, podium profile deficits, training recommendations
- **URL change:** `/profile` → `/readiness` via 301 redirect
- **Rename reason:** "Profile" is confusing because `/athlete/profile` already exists as the main account profile

---

## Section 2: Sidebar & URL Migration

### 2.1 New athlete sidebar structure

Edit `ATHLETE_NAV_SECTIONS` at `src/components/ui/Sidebar.tsx:395`. Only the items in bold change:

| Position | Current | Proposed |
|---|---|---|
| 1 | Dashboard → `/athlete/dashboard` | Dashboard → `/athlete/dashboard` |
| 2 | Training → `/athlete/sessions` | Training → `/athlete/sessions` |
| 3 | **Throw History → `/athlete/throws`** | **Throws** (section, nested) |
| 3a | | &nbsp;&nbsp;Today → `/athlete/throws` |
| 3b | | &nbsp;&nbsp;Log a Throw → `/athlete/throws/log` |
| 3c | | &nbsp;&nbsp;**History → `/athlete/throws/history`** *(new)* |
| 3d | | &nbsp;&nbsp;Trends & PRs → `/athlete/throws/trends` |
| 3e | | &nbsp;&nbsp;Readiness → `/athlete/throws/readiness` |
| 4 | Team → `/athlete/team` | Team → `/athlete/team` |
| 5 | Team Hub → `/athlete/hub` | Team Hub → `/athlete/hub` |
| 6 | Availability → `/athlete/availability` | Availability → `/athlete/availability` |
| 7 | Wellness Check-in → `/athlete/wellness` | Wellness Check-in → `/athlete/wellness` |

The `Sidebar.tsx` component already supports nested sub-items (the coach side uses them at lines 332-361 for Training → Throws Hub / Programming / Live Practice). This change is purely config — no new components.

### 2.2 URL migration map

| # | Old URL | New URL | Action | Why |
|---|---|---|---|---|
| 1 | `/athlete/throws` | `/athlete/throws` | Content rewritten | Becomes the focused Today view |
| 2 | `/athlete/throws/log` | `/athlete/throws/log` | Scope narrowed | Remove charts + past entries |
| 3 | *(none)* | `/athlete/throws/history` | New route + page | Actual history that didn't exist |
| 4 | *(none)* | `/athlete/throws/session/[id]` | New read-only view | Destination for "View full session" link from History |
| 5 | `/athlete/throws/analysis` | `/athlete/throws/trends` | Rename + 301 redirect | Clearer name; avoid collision with coach video-analysis |
| 6 | `/athlete/throws/profile` | `/athlete/throws/readiness` | Rename + 301 redirect | Disambiguate from `/athlete/profile` |
| 7 | `/athlete/throws/quiz` | *(unchanged)* | Unchanged | Typing quiz, unrelated, out of scope |
| 8 | `/athlete/throws/live/[assignmentId]` | *(unchanged)* | Unchanged | In-session player is correct |

### 2.3 Redirect strategy

Use `next.config.mjs` `redirects()` for URL renames (rows 5 and 6 above). Permanent 301, handled at the framework edge, zero server runtime cost. Keeps bookmarks working forever and the migration is transparent to users.

```js
// next.config.mjs (fragment)
async redirects() {
  return [
    { source: '/athlete/throws/analysis', destination: '/athlete/throws/trends', permanent: true },
    { source: '/athlete/throws/profile', destination: '/athlete/throws/readiness', permanent: true },
  ];
}
```

### 2.4 Elements deleted

- Action chip row at `src/app/(dashboard)/athlete/throws/page.tsx:199-218` ("View PRs / Throw history / Analysis"). The sidebar replaces it.
- "Past sessions" block on `/athlete/throws` — moves to History
- Trend chart widgets (`BestMarkChart`, `VolumeChart`) currently in `/log` — already live on Trends; remove from Log

---

## Section 3: History Page Design

### 3.1 What the page is

A scrollable reverse-chronological timeline of everything the athlete has thrown, aggregated from two sources:

1. **`ThrowLog`** (`prisma/schema.prisma:598`) — free/quick-logged throws with their own `date` field
2. **`ThrowsBlockLog`** (`prisma/schema.prisma:1378`) — throws from assigned sessions, joined via `ThrowsAssignment.assignedDate` for the grouping key

**Which assignments are included:** any `ThrowsAssignment` in status `IN_PROGRESS` or `COMPLETED` that has at least one `ThrowsBlockLog` row. Assignments in status `SKIPPED` or `ASSIGNED` (not started) have no logs by definition and therefore do not appear — an athlete only sees what they actually threw. If a coach-assigned session was started but skipped midway through, the partial logs still appear because throws that happened are still history.

**Grouping key:** the day is derived from `ThrowsAssignment.assignedDate` for block logs and from `ThrowLog.date` for free logs — both are the calendar date the athlete intended to train on, not the `createdAt` wall-clock of the insert (which can drift when logging the next morning).

Results are normalized into a unified `HistoryDay[]` shape on the server and returned pre-grouped.

### 3.2 Page states

**State 0: Loading.** Initial fetch renders 3 shimmer-skeleton day cards (using existing `shimmer-contextual` class) so the page has visual presence while the API runs. See Section 6.1 for full error/loading behavior.

**State 1: Default timeline.** Filter chip row at top, filter summary line below, day cards stacked. Each day card shows weekday + date, event badges, total throw count, best mark, and a PR badge if any throw that day was a PR. Week dividers separate weeks. Default filter is "Last 30 days" to keep first-load responsive.

**State 2: Expanded day.** Tapping a day card expands it in place — no navigation away. Shows every drill row for that day with implement, throw count, and best mark. Assigned sessions get a "View full session →" link to the read-only session view at `/athlete/throws/session/[id]`. Free logs don't get this link.

**State 3: Filters-return-nothing.** User has applied filters that match zero days. Render "No throws match these filters" card with a "Clear filters" button (primary action) that resets filter state to defaults.

**State 4: No throws ever (empty state).** Athlete has never logged any throw. Centered icon + "No throws yet" title + description + "Log a Throw" CTA pointing to `/athlete/throws/log`. Distinguished from State 3 by checking whether the unfiltered totals are zero.

**State 5: Error.** Fetch failed. Inline error card with retry button. Also fires `useToast().error()` — never silent. See Section 6.1.

### 3.3 Filters (chip row, horizontal scroll)

Each chip opens a **bottom sheet** rather than a dropdown — better thumb UX on mobile:

| Chip | Values |
|---|---|
| Date range | 7d, **30d (default)**, 90d, YTD, All time, Custom |
| Event | **All (default)**, Shot Put, Discus, Hammer, Javelin (multi-select) |
| Implement | **All (default)**, event-specific weight list (contextual — only shows implements the athlete has actually thrown) |
| PR | **Off (default)**, On (PR-only) |

Plus a "Clear filters" chip at the end of the row when any filter is active.

### 3.4 Sub-components (new)

1. `<HistoryFilterChips>` — chip row with state management + bottom sheet dispatch
2. `<HistoryDayCard>` — single day, handles collapsed/expanded state, uses `aria-expanded`
3. `<HistoryDrillRow>` — one drill row inside the expanded day
4. `<HistoryEmptyState>` — no-data state with CTA (State 4 in Section 3.2)
5. `<HistoryFiltersEmptyState>` — filters-return-nothing card with Clear button (State 3)
6. `<HistoryErrorState>` — error card with retry (State 5)
7. `<HistoryWeekDivider>` — week separator line
8. `<HistoryFilterSheet>` — **single generic bottom sheet component** that accepts a `variant` prop (`"range" | "event" | "implement" | "pr"`) and renders the appropriate control. One component, four variants — not four separate components. This keeps sheet animation and focus-trap behavior in one place.

### 3.5 API route

**`GET /api/throws/history`**

Query params (all optional, Zod-validated via `parseQuery()`):
- `range`: `"7d" | "30d" | "90d" | "ytd" | "all" | "custom"` (default `"30d"`)
- `start`, `end`: ISO date strings (only when `range=custom`)
- `events`: comma-separated `"SHOT_PUT,DISCUS,..."` (default: all)
- `implements`: comma-separated kg values (default: all)
- `prOnly`: boolean (default: false)
- `cursor`: opaque pagination cursor (for infinite scroll)

Response:
```typescript
{
  success: true,
  data: {
    days: HistoryDay[],
    nextCursor: string | null,
    totals: { sessions: number; throws: number }  // for the filter summary line
  }
}
```

Pagination by day (30 days per page), infinite-scroll on client. Index check required on `ThrowLog` for `(athleteId, date)` — add migration if missing.

### 3.6 PR detection

**MUST** call the Unified PR Read Layer (per `2026-04-10-unified-pr-read-layer-design.md`) rather than re-deriving per row. This prevents the "duplicate PR rows" bug the tester reported on 2026-04-10 (see memory ref `feedback_tester_session_2026_04_10.md`). If the Unified PR Layer is not yet shipped at implementation time, fall back to reading `ThrowLog.isPersonalBest` and noting the dependency to upgrade once the layer ships.

### 3.7 Read-only session view — `/athlete/throws/session/[id]`

New page, part of this spec. Renders an assigned session read-only: session name, event, date, blocks with their throw logs, RPE, self-feeling, coach feedback. This is the destination for "View full session →" from History. The existing `/athlete/throws/live/[assignmentId]` page is only for IN_PROGRESS sessions and assumes mutable state — reusing it for historical reads would require too many conditionals.

### 3.8 Styling (per CLAUDE.md design system rules)

- **Typography:** `Chakra Petch` for page heading and dates; `DM Sans` for labels/descriptions; `IBM Plex Mono` for all numeric values (throw counts, distances, dates). Numeric values use `tabular-nums` for alignment.
- **Colors:** event badge colors from the existing `EVENT_META` constants. PR badge uses the amber/gold brand accent. No hardcoded hex values.
- **Cards:** day cards use `card` class; expanded state uses `card-interactive` for the tap target. Week dividers use muted border tokens.
- **Animations:** day card expand/collapse uses CSS transition. Filter sheet slide-in respects `prefers-reduced-motion`. Progress bars and shimmer skeletons use existing `shimmer-contextual` class.

---

## Section 4: Audit Criteria & Methodology

### 4.1 Scope

Audit targets, per Question 2 of the brainstorm:
- **Athlete-side sidebar** (`ATHLETE_NAV_SECTIONS`)
- **All athlete pages reachable from the sidebar** under `src/app/(dashboard)/athlete/`
- **Every clickable element** (Link, button, card with onClick) on those pages

Out of scope: coach-side, marketing pages, auth flows.

### 4.2 Categories

| # | Category | Detection rule | Automatable? |
|---|---|---|---|
| A | Label ↔ destination mismatch | For each clickable element, read destination page; does label's promise match page's primary content? | Partial (LLM judgment) |
| B | Dead / 404 / no-op | Verify each href maps to a real route; verify each onClick handler does non-trivial work | Yes (grep + route check) |
| C | Duplicate labels | Collect labels; normalize; flag labels pointing to ≥2 destinations OR same dest with ≥2 labels | Yes (static analysis) |
| D | Missing back / exit | Each non-landing page must have a Back button, exit link, or `<Breadcrumbs>` | Yes (grep for imports) |
| E | Wrong nesting | Each sidebar item belongs in a section matching its purpose | Partial (needs rule) |
| F | Breadcrumb mismatches | For pages using `<Breadcrumbs>`, walk chain; verify matches actual parent routes | Yes (static analysis) |
| G | Page incoherence | Page doing ≥3 unrelated things. **Deferred outside throws family** — flag only | No (judgment only) |
| H | Flow endpoints | For each `onSubmit`/`onSave`, trace `router.push()` in success handler; does post-save dest make sense? | Yes (grep + trace) |

### 4.3 Detection rule for category E (wrong nesting)

Since "wrong nesting" needs a rule, use this classification:
- **Training / Throws** — anything about what the athlete trains today or over time (sessions, throws, lifts, drills)
- **Insights** — anything about the athlete's body, readiness, wellness, recovery
- **Team** — anything about coach, teammates, roster, competitions
- **Account / Settings** — anything about the athlete's identity, preferences, integrations, payments

Sidebar items that fall outside all four (or fit multiple) are flagged for discussion.

### 4.4 Finding format

```
F-### — <short description>
  Category: <A-H>
  Severity: HIGH | MEDIUM | LOW
  Location: <file:line>
  Element: <component or label>
  Label says: "<text>"
  Destination: <URL or handler>
  Destination actually shows: <description>
  Proposed fix: <rename | redirect | delete | add-back-button | etc.>
  Handled by: IA rework (auto-fixed) | mechanical fix | needs discussion | deferred
  Status: pending | approved | applied
```

Each finding resolves to one of four outcomes:
1. **Auto-fixed by IA rework** — the rework in Sections 1-3 already addresses it
2. **Mechanical fix** — simple label rename, href change, or breadcrumb fix
3. **Needs discussion** — ambiguous or touches deferred scope
4. **Deferred** — category G outside throws family

### 4.5 Execution approach

**Phase 3a — Mechanical sweep (dispatched to `Explore` subagent).** Subagent crawls athlete sidebar + throws family + adjacent pages, runs categories B, C, D, F, H via grep and static analysis, returns JSON findings list. Deterministic, reproducible.

**Phase 3b — Judgment pass (main agent).** Read each page the subagent flagged plus each page in the throws family, apply categories A, E, G-flagging rules. Merge with Phase 3a findings into a single findings doc at `docs/superpowers/findings/2026-04-11-athlete-nav-audit.md`.

**Phase 3c — Triage with user.** Walk through findings, decide fix-vs-defer on ambiguous cases, group mechanical fixes into batched commits.

**Phase 3d — Fix application.** Apply fixes in priority order; re-run Phase 3a subagent after fixes to verify no regressions.

---

## Section 5: Execution Plan & Fix Priority

### 5.1 Phase sequence

```
Phase 0 · Setup (this session)
  └─ Write spec → write implementation plan → user reviews both

Phase 1 · IA rework (biggest user-visible wins first)
  ├─ 1a. Next.js redirects for /analysis → /trends, /profile → /readiness
  ├─ 1b. Sidebar restructure (new Throws section + 5 sub-items)
  ├─ 1c. /athlete/throws content rewrite → Today view only
  └─ 1d. /athlete/throws/log scope-down (remove charts + past entries)

Phase 2 · New History page + read-only session view
  ├─ 2a. API route /api/throws/history (tests first, TDD)
  ├─ 2b. Page components (HistoryDayCard, HistoryFilterChips, etc.)
  ├─ 2c. Read-only session view at /athlete/throws/session/[id]
  └─ 2d. Verify /athlete/throws/history and /session/[id] render end-to-end

Phase 3 · Audit sweep (after rework ships)
  ├─ 3a. Subagent mechanical sweep (B, C, D, F, H)
  ├─ 3b. Main-agent judgment sweep (A, E, G-flagging)
  └─ 3c. Merge into findings doc, triage with user

Phase 4 · Mechanical fixes applied in priority order
  └─ One commit per category group

Phase 5 · Verification
  ├─ 5a. Re-run subagent sweep (should return 0 findings in fixed cats)
  ├─ 5b. Manual click-through of every sidebar item
  ├─ 5c. Sidebar href resolution test (new permanent regression guard)
  └─ 5d. npm run lint + tsc --noEmit
```

**Why Phase 1 before Phase 3:** The IA rework auto-fixes the biggest known finding (the "Throw History" label) and several adjacent ones, so running the audit afterward avoids generating noise about things already resolved.

### 5.2 Fix priority rubric

| Priority | Meaning | Categories | Where |
|---|---|---|---|
| P0 | Actively broken label/destination pairs the user complained about | A, C | Auto-fixed in Phase 1 |
| P1 | Mechanical fixes surfaced by audit | A, B, C | Phase 4, per-category commits |
| P2 | Polish: breadcrumbs, flow endpoints, nesting | D, E, F, H | Phase 4, grouped commit |
| P3 | Category G outside throws family | G | **Deferred** — flagged for future brainstorm |

**Ambiguity rule:** If a finding could be fixed by renaming the label OR redirecting to a different destination, default to renaming the label unless the destination is already widely linked-to.

### 5.3 Commit sequence

```
1. chore(throws): add redirects for /analysis → /trends, /profile → /readiness
2. feat(throws): new /athlete/throws/history timeline page
3. feat(throws): /athlete/throws/session/[id] read-only session view
4. refactor(athlete/nav): restructure sidebar with Throws section + 5 sub-items
5. refactor(throws): scope /athlete/throws down to Today view, drop action chips
6. refactor(throws/log): remove trend chart + past-entries list from /log
7. fix(athlete/nav): apply mechanical audit fixes [N findings across categories A-H]
8. test(athlete/nav): sidebar href resolution regression guard
```

Eight commits, each independently reversible, each with a focused commit message.

### 5.4 Testing strategy

**TDD-required (write tests first):**
- `/api/throws/history` endpoint — date grouping, filter param handling, aggregation of both sources, PR detection via Unified PR system
- `<HistoryDayCard>` expand/collapse state machine
- Next.js redirect config — verify old URLs resolve

**Regression guard (new permanent test):**
A test file at `src/__tests__/sidebar-resolution.test.ts` that imports `ATHLETE_NAV_SECTIONS` and verifies every href resolves to an actual `page.tsx` under `src/app/(dashboard)/athlete/`. Catches the exact class of bug this rework fixes, forever.

**Manual verification checklist before PR:**
- [ ] Tap every sidebar item on mobile, verify destination title matches label
- [ ] Expand 3 random days in History, verify drill rows render
- [ ] Filter History by event, date range, PR-only — verify results update
- [ ] Visit `/athlete/throws/analysis` → redirects to `/trends`
- [ ] Visit `/athlete/throws/profile` → redirects to `/readiness`
- [ ] `npm run lint` → 0 errors (warnings OK)
- [ ] `tsc --noEmit` → 0 errors

---

## Section 6: Error Handling, Accessibility, Performance

### 6.1 Error handling

Per CLAUDE.md Rules #1 and #2:

**History API (`/api/throws/history`):**
- Returns canonical envelope `{ success: true, data: T }` or `{ success: false, error: string }` — never ad-hoc keys
- Zod-validated query params via `parseQuery()`
- Invalid params → 400 with field error, not 500
- DB errors → logged server-side, 500 generic message client-side
- Never swallows errors silently

**Client-side (`/athlete/throws/history`):**
- Loading: shimmer skeleton day cards using `shimmer-contextual`
- Error state: inline error card with retry button + `useToast().error()` — **never silent**
- Empty state after filter: "No throws match these filters. Clear filters." + one-tap reset
- Empty state for new athlete: "No throws yet" + CTA to `/log`

**Redirect failures:** Old URLs should 301. The regression guard test catches config drift in CI.

### 6.2 Accessibility

- Day cards are `<button>`, not `<div onClick>`
- Expand/collapse announces via `aria-expanded`
- Filter chips are real `<button>` elements
- Bottom sheets trap focus, restore on close, dismissible via Escape
- Event badges have accessible text, not icon-only (colors supplementary)
- All animation respects `prefers-reduced-motion` (page already has `window.matchMedia` usage — reuse that pattern)

### 6.3 Performance

- **Default 30-day window** limits initial payload
- **Infinite scroll** for older history, 30 more days per fetch
- **Server-side pagination**, not client-side filtering
- **Memoize filter state** so switching drawer pages doesn't blow cache
- **Verify `ThrowLog` composite index** on `(athleteId, date)`; add migration if missing. `ThrowsBlockLog` already has `@@index([createdAt])` per `prisma/schema.prisma:1395`.

---

## Dependencies

| Dependency | Status | Mitigation if not ready |
|---|---|---|
| Unified PR Read Layer (`2026-04-10-unified-pr-read-layer-design.md`) | Approved, implementation pending | Fall back to `ThrowLog.isPersonalBest` with a TODO comment; upgrade once the layer ships |
| Read-only session view `/athlete/throws/session/[id]` | New, part of this spec | Build in Phase 2 — blocker for History's "View full session" link |
| `ThrowLog` composite index on `(athleteId, date)` | Unknown | Check during Phase 2; add migration if missing |
| Sidebar component nested sub-items | Already supported (coach side uses) | None |

## Risks

1. **Scope creep via category G findings.** The audit may surface category G incoherence OUTSIDE the throws family (e.g., `/athlete/wellness` doing too many things). Rule: **flag but don't fix**. Each one is a potential future rework. Do not expand scope mid-implementation.

2. **Training Hub overlap.** `/athlete/sessions` (Training Hub) and the new `/athlete/throws` (Today view) will both answer "what should I train right now?" to some degree. If users get confused, the Training Hub may need adjustment to clarify itself vs throws-specific Today. Out of scope for this pass; potential follow-up brainstorm.

3. **Assigned-vs-freestyle unification.** Merging `ThrowLog` and `ThrowsBlockLog` in the History query is the first place in the codebase they're treated as one thing. Data model quirks (different field names, different grouping keys) may surface. Fallback: server-side normalization layer in the API route, not a refactor of both tables.

4. **Unified PR system readiness.** If not shipped when History lands, fallback path works but PR badges may not match other PR displays until both ship. Accept this risk because the Unified PR Read Layer is spec-approved and imminent.

## Open Questions (non-blocking — can resolve during implementation)

- Should the "Clear filters" button be a chip at the end of the filter row, or a separate link in the summary line? *(Default: chip at end.)*
- Should free-logged throws display their `selfFeeling` value on the day card? *(Default: yes if space allows.)*
- Does a `<BottomSheet>` component already exist in `src/components/ui/`, or must it be built? *(Check during Phase 2; build minimal if not.)*

## References

- Brainstorm conversation from 2026-04-11 that produced this spec
- Related spec: `docs/superpowers/specs/2026-04-10-unified-pr-read-layer-design.md` (Unified PR Read Layer — dependency)
- Related spec: `docs/superpowers/specs/2026-03-25-athlete-training-hub-design.md` (Training Hub — adjacent concern, out of scope)
- Memory: `feedback_tester_session_2026_04_10.md` — user testing revealed duplicate PR rows
- Memory: `feedback_mobile_first_mockups.md` — always design mobile-first
- Memory: `project_unified_pr_system.md` — ongoing PR consolidation
- Memory: `feedback_production_readiness_2026_04_10.md` — broader UX gaps flagged
- Current throws page: `src/app/(dashboard)/athlete/throws/page.tsx`
- Current sidebar: `src/components/ui/Sidebar.tsx:395` (`ATHLETE_NAV_SECTIONS`)
- Schema references: `prisma/schema.prisma:598` (`ThrowLog`), `prisma/schema.prisma:1378` (`ThrowsBlockLog`)
- CLAUDE.md Code Quality Standards (API envelope, catch blocks, numeric parsing, Zod validation, form feedback)
- CLAUDE.md Design System Rules (cards, icons, typography, animation, confirmations, numeric display)
