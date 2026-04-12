# Throws Hub — Widget Composition Design Spec

**Date:** 2026-04-11
**Status:** Draft — pending user review
**Approach:** Reuse the existing `/athlete/dashboard` widget architecture on `/athlete/throws`, composed with a curated throws-relevant widget set and two new throws-specific fetchers

---

## Problem

The IA rework that shipped earlier today (PR #19, merged in `08ffc95`) correctly solved the "sidebar labels don't match their destinations" problem. The new athlete sidebar has a nested **Throws** section with 5 focused sub-items (Today, Log a Throw, History, Trends & PRs, Readiness), and each one lands on a real page with the right content.

But the rework did NOT solve a deeper problem: **the destinations themselves are spartan**. In particular, `/athlete/throws` — the default landing when the user clicks the Throws section — was scoped down during Task 14 to answer a single question ("what should I do right now for my throwing training?"). In practice that means the page shows one of:

1. The current scheduled throws session with a Start button
2. A "Rest Day" card with an "upcoming session" hint
3. An in-progress session that can be resumed

That's it. No PR badges, no readiness snapshot, no weekly throw volume, no streak indicator, no "what was the last thing I threw." Navigation works correctly; it's just leading to empty rooms.

The user's direct complaint after testing the shipped IA rework:

> "the throws tab is a little confusing."
>
> (on follow-up) "idk i think it could just be more intuitive and display data more efficiently and smartly."

The user isn't reporting a labels or structure problem — the IA rework already fixed those. They're reporting a **content density** problem: when they click the Throws tab, they expect to see their training status at a glance, but instead they see a single session card or a Rest Day.

Meanwhile, `/athlete/dashboard` has a full widget architecture (`src/app/(dashboard)/athlete/dashboard/_widgets/*`) with 13 widgets covering readiness, personal bests, PR tracking, training volume, today's workout, this-week tallies, weekly goals, workout calendar, quick stats, upcoming sessions, recent videos, goals progress, and pending questionnaires. The components exist. The fetchers (mostly) exist. The customize panel exists. They're just not surfaced on `/athlete/throws`.

**Root cause:** The rework scoped `/athlete/throws` down to pure "Today" content without considering that a throws-focused athlete opening their Throws tab wants to see throws-focused STATUS, not just a single session row. The widget architecture next door is the obvious answer.

## Goals

1. **Fill `/athlete/throws` with data-dense content** that tells the user their throws training status at a glance, without making them click through to the 4 sibling sub-pages.
2. **Reuse existing widget components** from `/athlete/dashboard/_widgets/` rather than building new ones. Zero new widgets in v1 — this is a composition exercise, not a building one.
3. **Keep the IA rework intact.** The 5-item nested sidebar (Today / Log / History / Trends / Readiness) stays exactly as-is. The `/athlete/throws` URL stays. The sub-pages stay. Only the CONTENT of the Today landing changes.
4. **Ship v1 as a hardcoded widget preset.** No customize panel. A future v2 can add per-athlete customization following the same pattern as the main dashboard's `athlete.dashboardConfig` JSON field.
5. **Mobile-first.** Every layout decision made at 390px viewport first, desktop is a scale-up. The existing dashboard widgets are already mobile-responsive, so the main constraint is the page-level composition (spacing, scroll behavior, tap targets).
6. **Don't break the main dashboard.** The refactor required to reuse widgets must not introduce regressions on `/athlete/dashboard`.

## Non-Goals

- **Customize panel for the Throws Hub** — hardcoded preset only in v1. v2 can add customization using the same pattern as the dashboard.
- **Throws-only filtering on every widget** — for v1, widgets that might show lift data mixed in (notably `today-workout`) render as-is. Accept mild off-message behavior in edge cases.
- **New widget components built from scratch** — reuse only. Any new widgets are a separate future effort.
- **Tabs on the Throws Hub** — no Training/Health tabs, no sub-tabs. Single vertical scroll.
- **Changes to the sidebar structure** — the nested Throws section from PR #19 stays exactly as-is.
- **Changes to `/athlete/throws/live/[assignmentId]`** — the in-session player is out of scope.
- **Wearable/Whoop/Oura integration on the Throws Hub** — wearable data belongs on the main dashboard, not a throws-focused view.

---

## Section 1: Page Structure

### 1.1 Layout (mobile-first, ~390px viewport)

The new `/athlete/throws` page is a SERVER component (no `"use client"`) that composes 6 existing widgets in a single-column vertical stack:

```
┌──────────────────────────────────────────────┐
│ Header                                        │
│   "Throws" (text-display, font-heading)      │
│   "Your throws training at a glance" (muted) │
├──────────────────────────────────────────────┤
│ Quick Log CTA                                 │
│   Amber gradient, full-width                 │
│   56px tap target, pulses during 2-8pm local │
│   → navigates to /athlete/quick-log          │
├──────────────────────────────────────────────┤
│ Widget 1: Readiness Hero                      │
│   (ReadinessHeroWidget)                      │
├──────────────────────────────────────────────┤
│ Widget 2: Today's Workout                     │
│   (TodayWorkoutWidget, with Start button)    │
├──────────────────────────────────────────────┤
│ Widget 3: PR Tracker                          │
│   (PRTrackerWidget, 2-col grid at mobile)    │
├──────────────────────────────────────────────┤
│ Widget 4: This Week                           │
│   (ThisWeekWidget, inline sparkline)         │
├──────────────────────────────────────────────┤
│ Widget 5: Training Volume                     │
│   (TrainingVolumeWidget, 30-day chart)       │
├──────────────────────────────────────────────┤
│ Widget 6: Upcoming Sessions                   │
│   (UpcomingSessionsWidget, next 3 throws)    │
└──────────────────────────────────────────────┘
```

### 1.2 Widget selection rationale

| Widget | Widget ID | Rationale for inclusion |
|---|---|---|
| Readiness Hero | `readiness` | Directly answers "am I ready to throw hard today?" — the most important status question |
| Today's Workout | `today-workout` | Shows the assigned throws session with a Start CTA. Replaces the current `SessionCard` functionality with a widget-wrapped version |
| PR Tracker | `pr-tracker` | User complained they couldn't see their PRs at a glance. Already implement-keyed (throws-only by data model) |
| This Week | `this-week` | Weekly throw count + comparison to last week. Already throws-only (queries `prisma.throwLog` directly per `src/lib/data/dashboard-progress.ts:127`) |
| Training Volume | `volume` | 30-day training volume sparkline. Requires new throws-specific fetcher (see Section 3) |
| Upcoming Sessions | `upcoming-sessions` | Next 3 scheduled throws sessions. Requires new throws-specific fetcher (see Section 3) |

### 1.3 Widgets explicitly excluded from v1

- `calendar` (workout-calendar) — month view is too heavy for a scan; Upcoming Sessions covers forward-looking need
- `prs` (personal-bests) — duplicate of `pr-tracker`, which is more structured
- `quick-stats` — overlaps with `this-week` (streak + sessions count)
- `goals` — generic goals, not throws-specific; belongs on the main dashboard
- `videos` — recent coaching videos, not throws-specific
- `questionnaires` — pending coach questionnaires, not throws-specific
- `weekly-goal` — goal-setting UX is heavier than v1 needs; defer to v2

### 1.4 What is removed from the current `/athlete/throws/page.tsx`

- The 710-line client component in its entirety
- The `SessionCard` function definition (used only in this file; grep confirmed)
- The `handleStartSession` / `handleSkipSession` / `handleCompleteSession` state handlers
- The `activeAssignment` useState
- The `activeSessions` / `todaySessions` / `upcomingSessions` filter declarations
- The `useEffect` that fetches assignments client-side
- All the "Today / Rest Day / Upcoming" JSX

All session management (start/skip/complete) moves into the existing `today-workout` widget, which already handles the Start button flow by navigating to `/athlete/throws/live/[assignmentId]`. The Throws Hub is a read-only status surface.

---

## Section 2: Data Flow and Shared Infrastructure

### 2.1 Shared widget-renderer module (new file)

The existing dashboard's `WidgetRenderer` function and `FETCHERS` map live privately inside `src/app/(dashboard)/athlete/dashboard/page.tsx` (at line 362 for `WidgetRenderer`, lines 70-84 for `FETCHERS`). They are NOT currently exported. To reuse them on the Throws Hub, we extract both into a new shared file:

**New file:** `src/app/(dashboard)/athlete/_shared/widget-renderer.tsx`

This file exports:
- `WidgetRenderer({ id, data })` — dispatches a `WidgetId` to the correct widget component
- `FETCHERS: Record<WidgetId, (athleteId: string) => Promise<unknown>>` — the map of widget IDs to fetcher functions

Both are moved verbatim from the current `dashboard/page.tsx`. No behavioral changes.

**Changes to `dashboard/page.tsx`:**
- Delete the private `WidgetRenderer` function (line 362)
- Delete the `FETCHERS` const (lines 70-84)
- Delete ALL individual widget component imports (lines 54-66) — every widget used by the dashboard is rendered via `WidgetRenderer` at lines 223 and 264, so after extraction, `dashboard/page.tsx` never references the individual widget components directly. The wearable branch renders `<WearableDashboard>` (a different component, not a widget) and reuses the same `WidgetRenderer` for its training tab, so no widget imports need to stay
- Add `import { WidgetRenderer, FETCHERS } from "../_shared/widget-renderer";`
- Run `npm run typecheck` to discover any fetcher data type imports (lines 30-50 region) that become unused after the move. Delete only the ones TypeScript flags. Some type imports may still be used by the wearable data fetcher or other remaining logic — do NOT delete defensively.

Net effect on the dashboard: ~60 lines shorter, behavior identical. This is the "extract" step; it's the only part of the refactor that touches existing dashboard code.

### 2.2 Throws-specific fetchers (new file)

ONE of the six widgets needs a new fetcher. The other widget I originally flagged (`volume`) does NOT need a fetcher because the `VolumeWidget` is a self-fetching CLIENT component.

**Correction from initial analysis — VolumeWidget is client-fetch:**

The existing `WidgetRenderer` dispatches `case "volume": return <TrainingVolumeWidget />;` with NO PROPS (see `dashboard/page.tsx:377`). `TrainingVolumeWidget` is a thin wrapper around `VolumeWidget` (`src/app/(dashboard)/athlete/dashboard/_volume-widget.tsx`), which fetches its own data via `useEffect` → `fetch("/api/athlete/training-volume")`. The server-side `fetchVolumeData` stub in `dashboard.ts` is a NO-OP placeholder that exists only to satisfy the `FETCHERS` map's type — the data it returns is discarded. This means writing `fetchThrowsVolumeData` would be wasted work; the widget ignores anything the server pre-fetches. **For v1, we ship `VolumeWidget` as-is on the Throws Hub.** It hits its existing API route, which queries `trainingSession` + `practiceAttempt` + `athleteThrowsSession` and shows real mixed-source training data. This is documented as a known limitation — a future follow-up could either replace the widget with a throws-specific alternative or add throws-only filtering to the API route.

**The one new fetcher we DO need:**

| Widget | Existing fetcher problem | New fetcher |
|---|---|---|
| `upcoming-sessions` | `fetchUpcomingSessionsData` in `src/lib/data/dashboard.ts:689` queries the legacy `prisma.trainingSession` model, not `prisma.throwsAssignment` | `fetchUpcomingThrowsAssignments` |

**New file:** `src/lib/data/throws-hub.ts`

Exports:
- `fetchUpcomingThrowsAssignments(athleteId)` — queries `prisma.throwsAssignment` where `status IN ("ASSIGNED", "NOTIFIED", "IN_PROGRESS")` and `assignedDate >= today`, ordered by `assignedDate ASC`, limited to 3, returning the same `UpcomingSessionItem[]` shape the widget expects

Returns the same data shape the existing widget component consumes — no widget data-consumption changes required. This is the "adapter" pattern: new data source, same contract.

### 2.2a UpcomingSessionsWidget link-href modification (small widget change)

The existing `UpcomingSessionsWidget` hardcodes `href={`/athlete/sessions/${session.id}`}` (line 73 of `upcoming-sessions.tsx`). On the main dashboard this points at the legacy athlete-sessions detail page, which is correct for `trainingSession` rows. On the Throws Hub, upcoming rows are `throwsAssignment` IDs, and that URL would 404.

**Modification:** Add an optional `linkHrefBuilder` prop to `UpcomingSessionsWidget` with a backward-compatible default:

```tsx
export function UpcomingSessionsWidget({
  sessions,
  linkHrefBuilder = (session) => `/athlete/sessions/${session.id}`,
}: {
  sessions: UpcomingSessionItem[];
  linkHrefBuilder?: (session: UpcomingSessionItem) => string;
}) {
  // ... existing code, but use linkHrefBuilder(session) instead of the hardcoded string
}
```

**Throws Hub usage:** The page passes `linkHrefBuilder={(s) => s.status === "IN_PROGRESS" ? `/athlete/throws/live/${s.id}` : `/athlete/throws/session/${s.id}`}` so IN_PROGRESS assignments open the live player and completed/assigned ones open the read-only view.

**WidgetRenderer change:** Since `WidgetRenderer` doesn't know the page context, the Throws Hub page needs a local override that passes `linkHrefBuilder` directly. This is handled by rendering `UpcomingSessionsWidget` directly from the throws page for that one widget, rather than dispatching through `WidgetRenderer`. A small if-statement in the widget stack handles this.

### 2.3 Fetcher override pattern

The Throws Hub page builds its fetcher map by spreading the shared `FETCHERS` and overriding exactly ONE entry (`upcoming-sessions`):

```tsx
// src/app/(dashboard)/athlete/throws/page.tsx
import { FETCHERS as DASHBOARD_FETCHERS, WidgetRenderer } from "../_shared/widget-renderer";
import { fetchUpcomingThrowsAssignments } from "@/lib/data/throws-hub";
import type { WidgetId } from "../dashboard/_widget-registry";

const THROWS_HUB_FETCHERS = {
  ...DASHBOARD_FETCHERS,
  "upcoming-sessions": fetchUpcomingThrowsAssignments,
};

const THROWS_HUB_WIDGETS: WidgetId[] = [
  "readiness",
  "today-workout",
  "pr-tracker",
  "this-week",
  "volume",
  "upcoming-sessions",
];
```

**Why a local override instead of modifying the shared map:** The main dashboard still uses `fetchUpcomingSessionsData` (legacy `trainingSession` query). Modifying the shared map would change the dashboard's behavior, which is out of scope and breaks the "don't regress the dashboard" goal. The local override is scoped entirely to the Throws Hub page.

**The `volume` entry is NOT overridden** — it continues to call `fetchVolumeData` (the stub), but the `VolumeWidget` ignores the pre-fetched data and does its own client fetch on mount. This is slightly wasteful (one extra server call to a stub) but matches the existing dashboard behavior exactly, and avoids touching the shared `FETCHERS` map.

### 2.4 Page-level fetch pattern

The page parallel-fetches all 6 widgets using the override map:

```tsx
export default async function ThrowsHubPage() {
  const { athlete } = await requireAthleteSession();

  const entries = await Promise.all(
    THROWS_HUB_WIDGETS.map(async (w) => [w, await THROWS_HUB_FETCHERS[w](athlete.id)] as const)
  );
  const dataMap = Object.fromEntries(entries as [WidgetId, unknown][]);

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ScrollProgressBar />
      {/* Header + Quick Log CTA */}
      <StaggeredList className="space-y-5" staggerDelay={60}>
        {THROWS_HUB_WIDGETS.map((widgetId) => (
          <WidgetRenderer key={widgetId} id={widgetId} data={dataMap[widgetId]} />
        ))}
      </StaggeredList>
    </div>
  );
}
```

This is the exact same pattern the dashboard already uses (see `dashboard/page.tsx:116-127`). Parallel fetch means total latency ≈ slowest fetcher, not sum.

### 2.5 Data shapes

All six widgets have existing typed data contracts. The new throws-specific fetchers must return the same shapes:

- `ReadinessData` — from `@/lib/data/dashboard`
- `TodaySession[]` — from `@/lib/data/dashboard`
- `PRTrackerData` — from `@/lib/data/dashboard-progress`
- `ThisWeekData` — from `@/lib/data/dashboard-progress`
- `VolumeData` — from `@/lib/data/dashboard` (the widget consumes this shape; the new `fetchThrowsVolumeData` must return it)
- `UpcomingSessionItem[]` — from `@/lib/data/dashboard` (same requirement)

Before implementing the new fetchers, inspect each type and match exactly.

---

## Section 3: Migration Plan, Risks, and Testing

### 3.1 Commit sequence

**Commit 1: Extract shared widget infrastructure + add linkHrefBuilder prop**
- Create `src/app/(dashboard)/athlete/_shared/widget-renderer.tsx` with `WidgetRenderer` and `FETCHERS` moved from `dashboard/page.tsx`
- Update `dashboard/page.tsx` to import from the shared module
- Delete the now-duplicate widget component imports in `dashboard/page.tsx` (those consolidated in the shared file)
- Modify `UpcomingSessionsWidget` to accept an optional `linkHrefBuilder` prop with a backward-compatible default
- Verify: `npm run typecheck`, `npm run lint`, dashboard still renders identically on dev server (upcoming sessions still click through to `/athlete/sessions/[id]` because that's the default)
- Commit message: `refactor(athlete/dashboard): extract widget infrastructure + pluggable upcoming-sessions link`

**Commit 2: Add throws-specific upcoming assignments fetcher**
- Create `src/lib/data/throws-hub.ts` with `fetchUpcomingThrowsAssignments`
- Create `src/lib/data/__tests__/throws-hub.test.ts` with 3 tests (happy path shape, empty state, status filter correctness)
- Verify: `npm test -- src/lib/data/__tests__/throws-hub.test.ts`
- Commit message: `feat(throws-hub): add fetchUpcomingThrowsAssignments fetcher`

**Commit 3: Rewrite `/athlete/throws/page.tsx` as the Throws Hub**
- Replace the 710-line client component with the new server component
- Delete `SessionCard` and all assignment state/handlers
- Wire up `THROWS_HUB_WIDGETS` + the `THROWS_HUB_FETCHERS` override map (one entry)
- Render upcoming-sessions directly (not through WidgetRenderer) so the Throws Hub can pass its throws-specific `linkHrefBuilder`
- Keep the Quick Log CTA + header matching the mobile mockup
- Verify: `npm run typecheck`, `npm run lint`, dev server renders the new page with real data, sidebar regression test still passes
- Commit message: `feat(throws-hub): replace /athlete/throws with data-dense widget composition`

Each commit is independently revertible. If Commit 3 fails or has a bug, Commits 1 and 2 are still useful improvements (dashboard refactor + throws fetcher) that can stay on `main`.

### 3.2 Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Shared module refactor breaks the dashboard | HIGH | Do extraction in a separate commit. Verify dashboard renders correctly on dev server before moving to Commit 2. Rollback = `git revert` Commit 1. |
| R2 | New fetchers return wrong shape for their widgets | MEDIUM | Before implementing, read `TrainingVolumeWidget` and `UpcomingSessionsWidget` prop types and match exactly. Unit tests verify the shape. |
| R3 | `today-workout` widget shows today's LIFT session (not throws) on the Throws Hub | LOW | Accept for v1. Most throws-focused athletes train throws most days. v2: add a `scope: "throws"` filter param. |
| R4 | Current page's URL query-param behavior breaks some caller | LOW | The current page reads no query params; grep confirmed. Only entry is sidebar click. |
| R5 | One widget errors during server-side render → whole page 500s | MEDIUM | Wrap each widget render in React error boundary OR try/catch per fetcher. The dashboard already handles this; reuse the pattern. |
| R6 | Visual regression vs what users see today | LOW (intentional) | This IS the rework. Document in release notes. |
| R7 | Performance regression from fetching 6 widgets server-side | LOW | Same pattern as dashboard (13 widgets). Parallel fetch makes total latency ≈ slowest fetcher. |
| R8 | Sidebar regression test breaks | N/A | Refactor keeps `/athlete/throws/page.tsx` as a real file; test stays green. |
| R9 | `SessionCard` deletion breaks a caller elsewhere | LOW | Verified: all 3 uses are in the same file (lines 194, 211, 280). Safe to delete. |
| R10 | v1 still feels spartan for new athletes with no history | LOW | Each widget has its own empty state; the dashboard already handles this. |
| R11 | `fetchThrowsVolumeData` performance on athletes with thousands of throw logs | LOW | Query restricted to last 30 days, indexed on `(athleteId, date)`. Aggregation in JS is bounded. |

### 3.3 Testing strategy

**New tests (Commit 2):**
- `src/lib/data/__tests__/throws-hub.test.ts`:
  1. `fetchUpcomingThrowsAssignments` returns the right shape (array of `UpcomingSessionItem` with id, scheduledDate, status, planName, coachNotes)
  2. `fetchUpcomingThrowsAssignments` filters to `ASSIGNED` / `NOTIFIED` / `IN_PROGRESS` only — excludes `COMPLETED`, `SKIPPED`, `PARTIAL`
  3. `fetchUpcomingThrowsAssignments` returns empty array for athletes with no upcoming assignments

**Existing tests that must stay green:**
- `src/__tests__/nav/sidebar-resolution.test.ts` — the sidebar regression guard
- `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx`
- All test suites currently at 119/119 passing on `main` (as of commit `12dcd50`)

**Manual verification before merging Commit 3:**
- [ ] Dev server: `/athlete/throws` renders all 6 widgets on mobile viewport (iPhone preset in Chrome DevTools)
- [ ] PR tracker shows real PRs from seed data
- [ ] Today's workout shows either a session or empty state
- [ ] Volume sparkline shows real 30-day data
- [ ] Upcoming sessions shows real `ThrowsAssignment` rows
- [ ] Start button on today-workout navigates to `/athlete/throws/live/[id]`
- [ ] Quick Log CTA navigates to `/athlete/quick-log`
- [ ] Readiness score renders
- [ ] Page scrolls smoothly on mobile
- [ ] `/athlete/throws/analysis` still 308 → `/athlete/throws/trends`
- [ ] `/athlete/throws/profile` still 308 → `/athlete/throws/readiness`
- [ ] Sidebar "Throws → Today" highlights when on `/athlete/throws`
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` all green

**What is NOT tested:**
- End-to-end Playwright test for the Throws Hub page — not worth it for a compose-only page. Individual widget components already have implicit coverage via the dashboard's existing behavior.

---

## Section 4: Out of Scope / YAGNI

Explicitly NOT in this design:

- **Customize panel for the Throws Hub** — hardcoded preset only in v1
- **Throws-only filter for `today-workout`** — accept mixed data
- **Throws-only filter for `readiness`** — readiness is whole-athlete by nature
- **Weekly Goal widget** — heavier setup UX, defer to v2
- **Workout Calendar widget** — month view too heavy for the hub
- **New widget components built from scratch** — reuse only
- **Tabs on the Throws Hub** — single view
- **Wearable (Whoop / Oura) integration** — dashboard concern
- **Greeting header** ("Good morning, {name}.") — stays on main dashboard
- **Sidebar structural changes** — out of scope; IA rework stays
- **Changes to `/athlete/throws/live/[id]`** — in-session player is unchanged
- **Changes to the four sibling pages** (Log, History, Trends, Readiness) — those already have their own scope

---

## Dependencies

| Dependency | Status | Impact if unavailable |
|---|---|---|
| `WidgetRenderer` + `FETCHERS` in `dashboard/page.tsx` | Exists (private) | Commit 1 extracts to shared — required for the whole design |
| `fetchReadinessData`, `fetchTodayWorkoutData`, `fetchPRTrackerData`, `fetchThisWeekData` | Exist and return real data (verified) | None — ship as-is |
| `fetchVolumeData` | Exists but is a stub returning `{athleteId}` — unused because `VolumeWidget` is self-fetching | None in scope for v1 — `VolumeWidget` fetches its own data client-side from `/api/athlete/training-volume`, ships mixed throws+lifts data (documented limitation) |
| `fetchUpcomingSessionsData` | Exists but queries legacy `trainingSession` | Commit 2 replaces with `fetchUpcomingThrowsAssignments` |
| `UpcomingSessionsWidget` hardcoded link | Currently `/athlete/sessions/${id}` | Commit 1 adds optional `linkHrefBuilder` prop; Throws Hub passes a throws-aware builder |
| Individual widget components in `_widgets/*` | Exist and work | None |
| `prisma.throwLog`, `prisma.throwsAssignment` with proper indexes | Exist with `@@index([athleteId, date])` and `@@index([athleteId, assignedDate])` respectively | None |
| `requireAthleteSession` from `@/lib/data/athlete` | Exists, same import the dashboard uses | None |
| `ScrollProgressBar`, `StaggeredList` components | Exist | None |

---

## Risks Outside the Scope of This Spec

- **The main dashboard's `fetchVolumeData` stub** is still a latent bug. This spec does NOT fix it — the main dashboard's volume widget still shows placeholder data. A follow-up is warranted.
- **`fetchUpcomingSessionsData` querying the legacy `trainingSession` model** is also a latent issue for the main dashboard. Not fixed here.
- Both of the above should be filed as separate tech-debt items.

---

## References

- **Parent PR:** TrainerTechPro/podiumthrows#19 — the IA rework that created the current `/athlete/throws` Today view scope
- **Source spec for the IA rework:** `docs/superpowers/specs/2026-04-11-throws-history-nav-rework-design.md` — Section 1.1 defines the current "Today" content that this spec replaces
- **User complaint (brainstorm transcript):** "idk i think it could just be more intuitive and display data more efficiently and smartly"
- **Memory:** `feedback_mobile_first_mockups.md` — always mock up mobile view first
- **Memory:** `feedback_design_quality.md` — Framer-level polish required
- **Widget registry:** `src/app/(dashboard)/athlete/dashboard/_widget-registry.ts`
- **Dashboard page (current `WidgetRenderer` + `FETCHERS` owner):** `src/app/(dashboard)/athlete/dashboard/page.tsx`
- **Fetcher modules:** `src/lib/data/dashboard.ts`, `src/lib/data/dashboard-progress.ts`
- **Current `/athlete/throws` page being replaced:** `src/app/(dashboard)/athlete/throws/page.tsx`
- **Schema:** `prisma/schema.prisma` — `ThrowLog`, `ThrowsAssignment`, `ThrowsSession` models
- **CLAUDE.md** — Design System Rules, Quality Bar, Core Principles

---

## Self-Review Checklist

Before handing to writing-plans, this spec must pass:

- [ ] No TBDs, TODOs, or incomplete sections — everything is concrete
- [ ] No internal contradictions between sections
- [ ] Single implementation plan is sufficient (not so large it needs decomposition)
- [ ] No ambiguous requirements that could be interpreted two ways
- [ ] All data shapes, file paths, and type names are exact
- [ ] All dependencies are listed and their status verified
- [ ] The 3-commit sequence is atomically revertible
- [ ] Manual verification checklist covers all 6 widgets + regression points
