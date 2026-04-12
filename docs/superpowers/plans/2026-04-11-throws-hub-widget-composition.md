# Throws Hub Widget Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the spartan `/athlete/throws` Today view with a data-dense Throws Hub that reuses 6 existing dashboard widgets, composed via a shared widget-renderer module and one new throws-specific fetcher.

**Architecture:** Extract the dashboard's private `WidgetRenderer` + `FETCHERS` into a shared module, add a small `linkHrefBuilder` prop to `UpcomingSessionsWidget` for context-aware navigation, add one new fetcher for throws assignments, and rewrite `/athlete/throws/page.tsx` as a server component that composes the 6 widgets with a Quick Log CTA. Zero new widget components — reuse only.

**Tech Stack:** Next.js 14.2 App Router server components, TypeScript, Prisma ORM, Vitest, Tailwind.

**Source spec:** `docs/superpowers/specs/2026-04-11-throws-hub-widget-composition-design.md`

---

## Pre-work: codebase verifications (no commit)

Before starting any task, verify these facts are still true. Each is a 1-line grep or read.

- [ ] **`WidgetRenderer` is defined at `src/app/(dashboard)/athlete/dashboard/page.tsx:362`** and NOT exported. Use Read tool.
- [ ] **`FETCHERS` const is at `src/app/(dashboard)/athlete/dashboard/page.tsx:70-84`** with 13 entries mapping `WidgetId` → fetcher function.
- [ ] **`UpcomingSessionsWidget` hardcodes `href={`/athlete/sessions/${session.id}`}` at line 73** of `src/app/(dashboard)/athlete/dashboard/_widgets/upcoming-sessions.tsx`.
- [ ] **`VolumeWidget` at `src/app/(dashboard)/athlete/dashboard/_volume-widget.tsx` is a client component** that fetches from `/api/athlete/training-volume` in a `useEffect`. Verify line 1 has `"use client";` and line 34 has the fetch.
- [ ] **`SessionCard` is defined at `src/app/(dashboard)/athlete/throws/page.tsx:280`** and used only at lines 194 and 211 of the same file. No other usages across the repo.
- [ ] **`prisma.throwsAssignment`** has the fields: `id`, `sessionId`, `athleteId`, `assignedDate String`, `status String`, `session ThrowsSession @relation`. Confirmed at `prisma/schema.prisma:1341`.
- [ ] **`UpcomingSessionItem` type** is exported from `@/lib/data/dashboard` with `{ id, scheduledDate, status, planName, coachNotes }` fields. Confirmed at `src/lib/data/dashboard.ts:74-80`.
- [ ] **Vitest is the test runner** — `npm test` runs it. Confirmed.

If any verification fails, stop and re-read the spec before continuing.

---

## File Structure Overview

**Files to create (new):**

```
src/app/(dashboard)/athlete/_shared/
  widget-renderer.tsx                          # Shared WidgetRenderer + FETCHERS (extracted from dashboard)

src/lib/data/
  throws-hub.ts                                # New throws-specific fetcher

src/lib/data/__tests__/
  throws-hub.test.ts                           # 3 tests for fetchUpcomingThrowsAssignments
```

**Files to modify:**

```
src/app/(dashboard)/athlete/dashboard/page.tsx                       # Remove private WidgetRenderer + FETCHERS, import from shared
src/app/(dashboard)/athlete/dashboard/_widgets/upcoming-sessions.tsx # Add optional linkHrefBuilder prop
src/app/(dashboard)/athlete/throws/page.tsx                          # Full rewrite: 710 lines → ~100 lines
```

**Files NOT touched:**

- All 13 widget components in `src/app/(dashboard)/athlete/dashboard/_widgets/` except `upcoming-sessions.tsx`
- All fetcher modules (`src/lib/data/dashboard.ts`, `src/lib/data/dashboard-progress.ts`)
- The widget registry (`src/app/(dashboard)/athlete/dashboard/_widget-registry.ts`)
- The sidebar (`src/components/ui/Sidebar.tsx`)
- The 4 throws sub-pages (Log, History, Trends, Readiness)
- The read-only session view (`src/app/(dashboard)/athlete/throws/session/[id]/page.tsx`)

---

## Task 1 — Extract `WidgetRenderer` and `FETCHERS` to a shared module

**Files:**
- Create: `src/app/(dashboard)/athlete/_shared/widget-renderer.tsx`
- Modify: `src/app/(dashboard)/athlete/dashboard/page.tsx`

**Commit target:** `refactor(athlete/dashboard): extract widget infrastructure to shared module`

- [ ] **Step 1.1: Read the current `FETCHERS` const and all widget+fetcher imports**

Use Read tool on `src/app/(dashboard)/athlete/dashboard/page.tsx`, lines 1-90. Note the exact imports — you need to move them verbatim to the new file.

- [ ] **Step 1.2: Read the current `WidgetRenderer` function**

Use Read tool on `src/app/(dashboard)/athlete/dashboard/page.tsx`, lines 360-400. Note the exact switch cases — you need to move them verbatim too.

- [ ] **Step 1.3: Create the shared module file**

Create `src/app/(dashboard)/athlete/_shared/widget-renderer.tsx` with this content:

```tsx
// Shared widget infrastructure: WidgetRenderer dispatch + FETCHERS map.
// Extracted from dashboard/page.tsx so the throws hub can reuse it.

import type { WidgetId } from "../dashboard/_widget-registry";

/* ─── Widgets ───────────────────────────────────────────────────────────── */

import { ReadinessHeroWidget } from "../dashboard/_widgets/readiness-hero";
import { TodayWorkoutWidget } from "../dashboard/_widgets/today-workout";
import { WorkoutCalendarWidget } from "../dashboard/_widgets/workout-calendar";
import { PersonalBestsWidget } from "../dashboard/_widgets/personal-bests";
import { QuickStatsWidget } from "../dashboard/_widgets/quick-stats";
import { GoalsProgressWidget } from "../dashboard/_widgets/goals-progress";
import { TrainingVolumeWidget } from "../dashboard/_widgets/training-volume";
import { UpcomingSessionsWidget } from "../dashboard/_widgets/upcoming-sessions";
import { RecentVideosWidget } from "../dashboard/_widgets/recent-videos";
import { PendingQuestionnairesWidget } from "../dashboard/_widgets/pending-questionnaires";
import { ThisWeekWidget } from "../dashboard/_widgets/this-week";
import { PRTrackerWidget } from "../dashboard/_widgets/pr-tracker";
import { WeeklyGoalWidget } from "../dashboard/_widgets/weekly-goal";

/* ─── Fetchers ──────────────────────────────────────────────────────────── */

import {
  fetchReadinessData,
  fetchTodayWorkoutData,
  fetchCalendarData,
  fetchPRsData,
  fetchQuickStatsData,
  fetchGoalsData,
  fetchVolumeData,
  fetchUpcomingSessionsData,
  fetchVideosData,
  fetchQuestionnairesData,
  type ReadinessData,
  type TodaySession,
  type CalendarDay,
  type PRItem,
  type QuickStatsData,
  type GoalItem,
  type UpcomingSessionItem,
  type VideoItem,
  type QuestionnairesData,
} from "@/lib/data/dashboard";
import {
  fetchThisWeekData,
  fetchPRTrackerData,
  fetchWeeklyGoalData,
  type ThisWeekData,
  type PRTrackerData,
  type WeeklyGoalData,
} from "@/lib/data/dashboard-progress";

/* ─── Fetcher map ───────────────────────────────────────────────────────── */

export const FETCHERS: Record<WidgetId, (id: string) => Promise<unknown>> = {
  readiness: fetchReadinessData,
  "today-workout": fetchTodayWorkoutData,
  calendar: fetchCalendarData,
  prs: fetchPRsData,
  "quick-stats": fetchQuickStatsData,
  goals: fetchGoalsData,
  volume: fetchVolumeData,
  "upcoming-sessions": fetchUpcomingSessionsData,
  videos: fetchVideosData,
  questionnaires: fetchQuestionnairesData,
  "this-week": fetchThisWeekData,
  "pr-tracker": fetchPRTrackerData,
  "weekly-goal": fetchWeeklyGoalData,
};

/* ─── Widget Renderer ───────────────────────────────────────────────────── */

export function WidgetRenderer({ id, data }: { id: WidgetId; data: unknown }) {
  switch (id) {
    case "readiness":
      return <ReadinessHeroWidget data={data as ReadinessData} />;
    case "today-workout":
      return <TodayWorkoutWidget data={data as TodaySession[]} />;
    case "calendar":
      return <WorkoutCalendarWidget days={data as CalendarDay[]} />;
    case "prs":
      return <PersonalBestsWidget prs={data as PRItem[]} />;
    case "quick-stats":
      return <QuickStatsWidget data={data as QuickStatsData} />;
    case "goals":
      return <GoalsProgressWidget goals={data as GoalItem[]} />;
    case "volume":
      return <TrainingVolumeWidget />;
    case "upcoming-sessions":
      return (
        <UpcomingSessionsWidget
          sessions={data as UpcomingSessionItem[]}
        />
      );
    case "videos":
      return <RecentVideosWidget videos={data as VideoItem[]} />;
    case "questionnaires":
      return <PendingQuestionnairesWidget data={data as QuestionnairesData} />;
    case "this-week":
      return <ThisWeekWidget data={data as ThisWeekData} />;
    case "pr-tracker":
      return <PRTrackerWidget data={data as PRTrackerData} />;
    case "weekly-goal":
      return <WeeklyGoalWidget data={data as WeeklyGoalData} />;
    default:
      return null;
  }
}
```

- [ ] **Step 1.4: Update `dashboard/page.tsx` — remove the private copies and import from the shared module**

In `src/app/(dashboard)/athlete/dashboard/page.tsx`:

1. **Delete lines 30-66** (the type + fetcher imports from `@/lib/data/dashboard`, the progress imports, and ALL individual widget component imports). Replace with a single import line:

```tsx
import { FETCHERS, WidgetRenderer } from "../_shared/widget-renderer";
```

2. **Delete lines 70-84** (the entire `FETCHERS` const definition).

3. **Delete lines 360-400** (the entire `WidgetRenderer` function definition).

4. **Keep all other imports** that were mixed in around those lines. Specifically:
   - `fetchThisWeekData`, `fetchPRTrackerData`, `fetchWeeklyGoalData` from `@/lib/data/dashboard-progress` are now unused by `dashboard/page.tsx` directly — delete them from the dashboard page's imports.
   - Any types like `ReadinessData`, `TodaySession` that were only used by the private `WidgetRenderer` and FETCHERS map are now unused — delete them.

- [ ] **Step 1.5: Run typecheck to find unused imports and clean them up**

```bash
npm run typecheck
```

Expected: 0 errors. If TypeScript flags unused imports in `dashboard/page.tsx`, remove them. Do NOT delete imports that are still used elsewhere in the file (e.g., the wearable-data function at line 283 may still need some types).

- [ ] **Step 1.6: Run lint**

```bash
npm run lint
```

Expected: 0 errors/warnings.

- [ ] **Step 1.7: Run all existing tests**

```bash
npm test
```

Expected: all existing tests still pass. No test targets the `WidgetRenderer` function directly, so the extraction shouldn't cause any test failures.

- [ ] **Step 1.8: Manually verify the dashboard still renders**

```bash
npm run dev
# In a browser: log in as athlete1@example.com / athlete123
# Visit http://localhost:3000/athlete/dashboard
# Verify: the dashboard renders identically — all widgets visible, no console errors
# Stop the dev server (Ctrl-C)
```

- [ ] **Step 1.9: Commit**

```bash
git add src/app/\(dashboard\)/athlete/_shared/widget-renderer.tsx \
        src/app/\(dashboard\)/athlete/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
refactor(athlete/dashboard): extract widget infrastructure to shared module

Moves the private WidgetRenderer function and FETCHERS map out of
dashboard/page.tsx into a new shared module at
src/app/(dashboard)/athlete/_shared/widget-renderer.tsx. This lets the
Throws Hub (coming next) reuse the same dispatch + fetcher map without
duplicating 100+ lines.

No behavioral changes. Dashboard page is ~60 lines shorter. All widgets
still render identically.

Part of the Throws Hub widget composition work
(docs/superpowers/specs/2026-04-11-throws-hub-widget-composition-design.md).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Add `linkHrefBuilder` prop to `UpcomingSessionsWidget`

**Files:**
- Modify: `src/app/(dashboard)/athlete/dashboard/_widgets/upcoming-sessions.tsx`

**Commit target:** bundled with Task 1 — amend if still in review, OR commit separately if Task 1 has already been pushed. This plan treats it as a separate commit for clean rollback.

- [ ] **Step 2.1: Read the current widget file**

Use Read tool on `src/app/(dashboard)/athlete/dashboard/_widgets/upcoming-sessions.tsx`. Note the current `href` at line 73.

- [ ] **Step 2.2: Add the optional prop with a backward-compatible default**

Find this block (around lines 25-29):

```tsx
export function UpcomingSessionsWidget({
  sessions,
}: {
  sessions: UpcomingSessionItem[];
}) {
```

Replace with:

```tsx
export function UpcomingSessionsWidget({
  sessions,
  linkHrefBuilder = (session) => `/athlete/sessions/${session.id}`,
}: {
  sessions: UpcomingSessionItem[];
  linkHrefBuilder?: (session: UpcomingSessionItem) => string;
}) {
```

The default preserves the current behavior exactly — existing callers (the main dashboard via `WidgetRenderer`) get the same link they always had.

- [ ] **Step 2.3: Use the builder in the JSX**

Find this line (around line 73):

```tsx
                href={`/athlete/sessions/${session.id}`}
```

Replace with:

```tsx
                href={linkHrefBuilder(session)}
```

- [ ] **Step 2.4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 2.5: Run lint**

```bash
npm run lint
```

Expected: 0 errors/warnings.

- [ ] **Step 2.6: Run existing tests**

```bash
npm test
```

Expected: all existing tests still pass. The optional prop with a backward-compatible default is fully backwards compatible.

- [ ] **Step 2.7: Commit**

```bash
git add src/app/\(dashboard\)/athlete/dashboard/_widgets/upcoming-sessions.tsx
git commit -m "$(cat <<'EOF'
feat(upcoming-sessions): add optional linkHrefBuilder prop

Adds a linkHrefBuilder prop to UpcomingSessionsWidget so different pages
can route upcoming session clicks to different destinations. The default
preserves the existing hardcoded /athlete/sessions/[id] behavior, so the
main dashboard is unchanged.

The Throws Hub (coming next) will pass a throws-aware builder that routes
IN_PROGRESS assignments to /athlete/throws/live/[id] and others to
/athlete/throws/session/[id].

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Write the failing test for `fetchUpcomingThrowsAssignments`

**Files:**
- Create: `src/lib/data/__tests__/throws-hub.test.ts`

**Commit target:** bundled with Task 4 (`feat(throws-hub): add fetchUpcomingThrowsAssignments fetcher`)

- [ ] **Step 3.1: Create the test file**

Create `src/lib/data/__tests__/throws-hub.test.ts` with this content:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma BEFORE importing the fetcher.
const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    throwsAssignment: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { fetchUpcomingThrowsAssignments } from "../throws-hub";

describe("fetchUpcomingThrowsAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the right shape (array of UpcomingSessionItem)", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "asgn-1",
        assignedDate: "2026-04-15",
        status: "ASSIGNED",
        session: { event: "SHOT_PUT", name: "Heavy Day" },
      },
      {
        id: "asgn-2",
        assignedDate: "2026-04-16",
        status: "NOTIFIED",
        session: { event: "DISCUS", name: "Comp Sim" },
      },
    ]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "asgn-1",
      scheduledDate: "2026-04-15",
      status: "ASSIGNED",
      planName: "Heavy Day",
      coachNotes: null,
    });
    expect(result[1].planName).toBe("Comp Sim");
  });

  it("filters to ASSIGNED / NOTIFIED / IN_PROGRESS only — excludes COMPLETED, SKIPPED, PARTIAL", async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchUpcomingThrowsAssignments("athlete-1");

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.status.in).toEqual(["ASSIGNED", "NOTIFIED", "IN_PROGRESS"]);
    expect(call.where.athleteId).toBe("athlete-1");
    expect(call.orderBy).toEqual({ assignedDate: "asc" });
    expect(call.take).toBe(3);
  });

  it("returns empty array for athletes with no upcoming assignments", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await fetchUpcomingThrowsAssignments("athlete-1");

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3.2: Run the test — expect failure**

```bash
npm test -- src/lib/data/__tests__/throws-hub.test.ts
```

Expected: FAIL with `Cannot find module '../throws-hub'` or similar. CONFIRM the failure before proceeding.

---

## Task 4 — Implement `fetchUpcomingThrowsAssignments`

**Files:**
- Create: `src/lib/data/throws-hub.ts`

**Commit target:** `feat(throws-hub): add fetchUpcomingThrowsAssignments fetcher`

- [ ] **Step 4.1: Create the fetcher file**

Create `src/lib/data/throws-hub.ts` with this content:

```ts
import prisma from "@/lib/prisma";
import type { UpcomingSessionItem } from "@/lib/data/dashboard";

/**
 * Fetches the next 3 upcoming throws assignments for an athlete.
 *
 * Queries `prisma.throwsAssignment` (the new throws scheduling model)
 * instead of the legacy `trainingSession` table. Returns data in the
 * `UpcomingSessionItem[]` shape so the existing `UpcomingSessionsWidget`
 * can consume it with no changes.
 *
 * Filters to ASSIGNED / NOTIFIED / IN_PROGRESS — excludes COMPLETED,
 * SKIPPED, and PARTIAL (those are history, not "upcoming").
 */
export async function fetchUpcomingThrowsAssignments(
  athleteId: string
): Promise<UpcomingSessionItem[]> {
  const assignments = await prisma.throwsAssignment.findMany({
    where: {
      athleteId,
      status: { in: ["ASSIGNED", "NOTIFIED", "IN_PROGRESS"] },
    },
    include: {
      session: { select: { event: true, name: true } },
    },
    orderBy: { assignedDate: "asc" },
    take: 3,
  });

  return assignments.map((a) => ({
    id: a.id,
    scheduledDate: a.assignedDate,
    status: a.status,
    planName: a.session.name,
    coachNotes: null,
  }));
}
```

- [ ] **Step 4.2: Run the test — expect pass**

```bash
npm test -- src/lib/data/__tests__/throws-hub.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 4.3: Run typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: 0 errors.

- [ ] **Step 4.4: Commit Tasks 3 + 4 together**

```bash
git add src/lib/data/throws-hub.ts src/lib/data/__tests__/throws-hub.test.ts
git commit -m "$(cat <<'EOF'
feat(throws-hub): add fetchUpcomingThrowsAssignments fetcher

New server-side fetcher that queries prisma.throwsAssignment (the new
throws model) instead of the legacy trainingSession table. Returns data
in the UpcomingSessionItem[] shape so the existing UpcomingSessionsWidget
can consume it without widget-component changes.

Filters to ASSIGNED / NOTIFIED / IN_PROGRESS — excludes COMPLETED,
SKIPPED, PARTIAL (those belong in the History page, not "upcoming").
Orders by assignedDate ASC, limited to 3.

Tests: 3 unit tests (shape, status filter, empty state).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Rewrite `/athlete/throws/page.tsx` as the Throws Hub

**Files:**
- Modify (full rewrite): `src/app/(dashboard)/athlete/throws/page.tsx`

**Commit target:** `feat(throws-hub): replace /athlete/throws with data-dense widget composition`

- [ ] **Step 5.1: Read the current page to confirm what gets deleted**

Use Read tool on `src/app/(dashboard)/athlete/throws/page.tsx`, the whole file. Confirm:
- It starts with `"use client";`
- It has `SessionCard` defined at line 280
- It uses `handleStartSession`, `handleSkipSession`, `handleCompleteSession`
- It has NO URL query params that other code depends on

All of this goes away.

- [ ] **Step 5.2: Replace the file entirely with the new server component**

Overwrite `src/app/(dashboard)/athlete/throws/page.tsx` with this content:

```tsx
import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";
import { StaggeredList } from "@/components";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { requireAthleteSession } from "@/lib/data/athlete";
import { UpcomingSessionsWidget } from "../dashboard/_widgets/upcoming-sessions";
import type { UpcomingSessionItem } from "@/lib/data/dashboard";
import type { WidgetId } from "../dashboard/_widget-registry";
import {
  FETCHERS as DASHBOARD_FETCHERS,
  WidgetRenderer,
} from "../_shared/widget-renderer";
import { fetchUpcomingThrowsAssignments } from "@/lib/data/throws-hub";

export const metadata = {
  title: "Throws",
};

// The six widgets shown on the Throws Hub, in render order.
// See docs/superpowers/specs/2026-04-11-throws-hub-widget-composition-design.md §1.2.
const THROWS_HUB_WIDGETS: WidgetId[] = [
  "readiness",
  "today-workout",
  "pr-tracker",
  "this-week",
  "volume",
  "upcoming-sessions",
];

// The fetcher map overrides exactly ONE entry (upcoming-sessions) with
// the throws-specific fetcher. All other widgets use the dashboard's
// existing fetchers, which are throws-relevant by data model.
const THROWS_HUB_FETCHERS = {
  ...DASHBOARD_FETCHERS,
  "upcoming-sessions": fetchUpcomingThrowsAssignments,
};

// Route upcoming session clicks to the right throws destination based on
// assignment status. IN_PROGRESS → live player. Everything else → read-only view.
function throwsLinkHrefBuilder(session: UpcomingSessionItem): string {
  return session.status === "IN_PROGRESS"
    ? `/athlete/throws/live/${session.id}`
    : `/athlete/throws/session/${session.id}`;
}

export default async function ThrowsHubPage() {
  const { athlete } = await requireAthleteSession();

  // Parallel fetch for all 6 widgets.
  const entries = await Promise.all(
    THROWS_HUB_WIDGETS.map(
      async (w) => [w, await THROWS_HUB_FETCHERS[w](athlete.id)] as const
    )
  );
  const dataMap = Object.fromEntries(entries as [WidgetId, unknown][]);

  const hour = new Date().getHours();
  const isPracticeHours = hour >= 14 && hour < 20;

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ScrollProgressBar />

      {/* Header */}
      <div>
        <h1 className="text-display font-heading text-[var(--foreground)]">Throws</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Your throws training at a glance
        </p>
      </div>

      {/* Quick Log CTA — mirrors the dashboard's hero button */}
      <Link
        href="/athlete/quick-log"
        className="group relative block rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 p-6 shadow-lg transition-transform active:scale-[0.98]"
        aria-label="Quick Log — tap to log a throw in seconds"
      >
        {isPracticeHours && (
          <span
            className="absolute inset-0 rounded-2xl ring-2 ring-primary-400 animate-pulse pointer-events-none"
            aria-hidden="true"
          />
        )}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Zap size={28} strokeWidth={2} className="text-white" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-2xl font-bold text-white">Quick Log</h2>
            <p className="text-sm text-white/80">Tap to log a throw in seconds</p>
          </div>
          <ChevronRight
            size={24}
            strokeWidth={1.75}
            className="text-white/60 group-hover:text-white transition-colors shrink-0"
            aria-hidden="true"
          />
        </div>
        {isPracticeHours && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold">
              🎯 Practice time
            </span>
          </div>
        )}
      </Link>

      {/* Widget stack */}
      <StaggeredList className="space-y-5" staggerDelay={60}>
        {THROWS_HUB_WIDGETS.map((widgetId) => {
          // upcoming-sessions gets rendered directly so we can pass the
          // throws-aware linkHrefBuilder. All other widgets go through
          // the shared WidgetRenderer dispatch.
          if (widgetId === "upcoming-sessions") {
            return (
              <UpcomingSessionsWidget
                key={widgetId}
                sessions={dataMap[widgetId] as UpcomingSessionItem[]}
                linkHrefBuilder={throwsLinkHrefBuilder}
              />
            );
          }
          return (
            <WidgetRenderer
              key={widgetId}
              id={widgetId}
              data={dataMap[widgetId]}
            />
          );
        })}
      </StaggeredList>
    </div>
  );
}
```

- [ ] **Step 5.3: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. All imports in Step 5.2 are verified to match the current codebase:
- `StaggeredList` is at `@/components` (same import the dashboard uses at `dashboard/page.tsx:10`)
- `requireAthleteSession` is at `@/lib/data/athlete` (same import the dashboard uses at `dashboard/page.tsx:3`)
- `WidgetId` is at `../dashboard/_widget-registry` (relative path from `throws/page.tsx` → `dashboard/_widget-registry`)

If typecheck does flag any import, stop and investigate before editing — the imports were correct at plan-write time.

- [ ] **Step 5.4: Run lint**

```bash
npm run lint
```

Expected: 0 errors/warnings.

- [ ] **Step 5.5: Run the sidebar regression test**

```bash
npm test -- src/__tests__/nav/sidebar-resolution.test.ts
```

Expected: both tests PASS. The refactor keeps `/athlete/throws/page.tsx` as a real file, so the sidebar's href for the Throws parent still resolves.

- [ ] **Step 5.6: Run the full test suite**

```bash
npm test
```

Expected: all tests still pass. The rewrite doesn't touch any test file or any component consumed by tests.

- [ ] **Step 5.7: Manually verify the Throws Hub renders**

```bash
npm run dev
# In a browser: log in as athlete1@example.com / athlete123
# Visit http://localhost:3000/athlete/throws on mobile viewport (Chrome DevTools → Device Mode → iPhone 14 Pro)
# Verify:
#   ☐ Page title reads "Throws"
#   ☐ Quick Log CTA is visible (amber gradient, full-width)
#   ☐ Readiness widget renders with a score
#   ☐ Today's workout widget renders (either a session or empty state)
#   ☐ PR tracker renders with real PRs from seed data
#   ☐ This Week widget renders with throw count
#   ☐ Training Volume widget renders (may take a moment — it's client-fetch)
#   ☐ Upcoming Sessions widget renders (may be empty if no upcoming assignments in seed data)
#   ☐ No console errors
# Tap an upcoming session (if any are visible)
# Verify: it navigates to /athlete/throws/session/[id] or /athlete/throws/live/[id] based on status
# Tap the Quick Log CTA
# Verify: it navigates to /athlete/quick-log
# Stop the dev server (Ctrl-C)
```

- [ ] **Step 5.8: Verify the redirects still work (regression)**

```bash
npm run dev
# In another terminal:
curl -I http://localhost:3000/athlete/throws/analysis
# Expected: HTTP/1.1 308 Permanent Redirect, Location: /athlete/throws/trends

curl -I http://localhost:3000/athlete/throws/profile
# Expected: HTTP/1.1 308 Permanent Redirect, Location: /athlete/throws/readiness
# Stop the dev server (Ctrl-C)
```

- [ ] **Step 5.9: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/page.tsx
git commit -m "$(cat <<'EOF'
feat(throws-hub): replace /athlete/throws with data-dense widget composition

Rewrites /athlete/throws from a 710-line client component showing a
single session card or Rest Day into a ~100-line server component that
composes 6 existing dashboard widgets: Readiness Hero, Today's Workout,
PR Tracker, This Week, Training Volume, Upcoming Sessions. Adds a Quick
Log CTA at the top mirroring the main dashboard's hero button.

The widget stack uses the shared WidgetRenderer module with one fetcher
override (upcoming-sessions) that points at the new fetchUpcomingThrows-
Assignments fetcher. Upcoming sessions are rendered directly (not via
WidgetRenderer dispatch) so the page can pass a throws-aware
linkHrefBuilder that routes clicks to /athlete/throws/live/[id] for
IN_PROGRESS assignments and /athlete/throws/session/[id] otherwise.

All session management (start / skip / complete) moves off this page
into the existing widgets and live player. The Throws Hub is now a
read-only status surface, consistent with the IA rework's "one page,
one purpose" principle.

Deletes SessionCard, handleStartSession, handleSkipSession,
handleCompleteSession, and all assignment state management (~630 lines
of now-unused code).

Addresses user feedback from post-rework testing:
"i think it could just be more intuitive and display data more
efficiently and smartly."

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Full verification sweep

**Files:** no file changes

**Commit target:** no commit — verification only

- [ ] **Step 6.1: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS. Specifically verify:
- `src/lib/data/__tests__/throws-hub.test.ts` — 3 tests (new)
- `src/__tests__/nav/sidebar-resolution.test.ts` — 2 tests (unchanged)
- `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx` — 4 tests (unchanged)
- `src/app/api/auth/__tests__/auth-routes.test.ts` — 26 tests (unchanged)
- Everything else — unchanged

- [ ] **Step 6.2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6.3: Run lint**

```bash
npm run lint
```

Expected: 0 errors/warnings.

- [ ] **Step 6.4: Manual sidebar click-through on mobile viewport**

```bash
npm run dev
# Open Chrome DevTools → Device Mode → iPhone 14 Pro
# Log in as athlete1@example.com / athlete123
# Click the hamburger menu
# Verify each athlete sidebar item:
#   ☐ Dashboard → dashboard renders with all widgets
#   ☐ Training → training hub renders
#   ☐ Throws (parent) → expands to show 5 sub-items
#     ☐ Today → lands on /athlete/throws Throws Hub with 6 widgets
#     ☐ Log a Throw → lands on /athlete/throws/log log form
#     ☐ History → lands on /athlete/throws/history timeline
#     ☐ Trends & PRs → lands on /athlete/throws/trends
#     ☐ Readiness → lands on /athlete/throws/readiness
#   ☐ Team → team page renders
#   ☐ Team Hub → hub renders
#   ☐ Availability → availability renders
#   ☐ Wellness Check-in → wellness renders
# Stop dev server
```

- [ ] **Step 6.5: Verify the dashboard still renders correctly (Task 1 regression check)**

```bash
npm run dev
# Visit /athlete/dashboard on mobile viewport
# Verify:
#   ☐ All dashboard widgets render as before
#   ☐ Customize panel still opens
#   ☐ No console errors
#   ☐ Upcoming sessions widget still links to /athlete/sessions/[id] (backward compat)
# Stop dev server
```

---

## Task 7 — Open the pull request

**Files:** no file changes

- [ ] **Step 7.1: Verify all commits are present**

```bash
git log --oneline origin/main..HEAD
```

Expected: exactly 4 commits in reverse order (one per feature-ful task; Task 3 tests are bundled into Task 4's commit):

```
<hash> feat(throws-hub): replace /athlete/throws with data-dense widget composition
<hash> feat(throws-hub): add fetchUpcomingThrowsAssignments fetcher
<hash> feat(upcoming-sessions): add optional linkHrefBuilder prop
<hash> refactor(athlete/dashboard): extract widget infrastructure to shared module
```

- [ ] **Step 7.2: Ask the user whether to push + open a PR**

Do NOT push without explicit user confirmation. If the user confirms:

```bash
# Cut a feature branch from current HEAD
git switch -c feature/throws-hub-widget-composition

# Reset local main back to origin/main
git switch main
git reset --hard origin/main

# Switch back to the feature branch and push
git switch feature/throws-hub-widget-composition
git push -u origin feature/throws-hub-widget-composition
```

- [ ] **Step 7.3: Open the PR (only if user confirms)**

```bash
gh pr create --title "Throws Hub — widget composition on /athlete/throws" --body "$(cat <<'EOF'
## Summary
- Rewrite `/athlete/throws` from a spartan Today view into a data-dense Throws Hub
- Reuse 6 existing dashboard widgets: Readiness, Today's Workout, PR Tracker, This Week, Training Volume, Upcoming Sessions
- Add a Quick Log CTA at the top (mirrors the main dashboard's hero button)
- Extract shared `WidgetRenderer` + `FETCHERS` from `dashboard/page.tsx` into a shared module
- Add optional `linkHrefBuilder` prop to `UpcomingSessionsWidget` for context-aware navigation
- Add `fetchUpcomingThrowsAssignments` — the one new server-side fetcher — that queries `throwsAssignment` instead of the legacy `trainingSession` table

## Test plan
- [ ] `npm test` — all tests pass (3 new, existing unchanged)
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 warnings
- [ ] Manual: `/athlete/throws` renders all 6 widgets on mobile viewport
- [ ] Manual: `/athlete/dashboard` still renders identically (regression check)
- [ ] Manual: Upcoming session click on the Throws Hub routes to `/athlete/throws/live/[id]` or `/athlete/throws/session/[id]` based on status
- [ ] Manual: Upcoming session click on the main dashboard still routes to `/athlete/sessions/[id]` (backward compat)

Source spec: `docs/superpowers/specs/2026-04-11-throws-hub-widget-composition-design.md`

Addresses user feedback after testing PR #19:
> "idk i think it could just be more intuitive and display data more efficiently and smartly"

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7.4: Return the PR URL to the user**

---

## Self-Review Checklist

After writing this plan, the agent executing it should verify:

**Spec coverage:**
- Section 1.1 (Layout) → Task 5 builds the page structure exactly as described
- Section 1.2 (Widget selection) → Task 5 hardcodes the 6 widgets in `THROWS_HUB_WIDGETS`
- Section 1.4 (What is removed) → Task 5 Step 5.2 does a full file overwrite that drops `SessionCard` + handlers + state
- Section 2.1 (Shared module) → Task 1 extracts `WidgetRenderer` and `FETCHERS`
- Section 2.2 (Throws-specific fetchers) → Tasks 3+4 add `fetchUpcomingThrowsAssignments`
- Section 2.2a (linkHrefBuilder prop) → Task 2 adds the optional prop
- Section 2.3 (Fetcher override pattern) → Task 5 implements `THROWS_HUB_FETCHERS = { ...DASHBOARD_FETCHERS, "upcoming-sessions": fetchUpcomingThrowsAssignments }`
- Section 3.1 (Commit sequence) → Tasks 1 / 2 / 4 / 5 map to the 4 commits (plus bundled test commit)
- Section 3.3 (Testing) → Task 3+4 provide the 3 unit tests; Task 6 runs the full verification sweep

**Placeholder scan:** No TBDs, TODOs, or "implement later" phrases. Every step has concrete code or an exact command.

**Type consistency:** `WidgetId` import path consistent across Task 1 and Task 5. `UpcomingSessionItem` type used consistently. `THROWS_HUB_WIDGETS` defined in Task 5 with the same 6 IDs listed in the spec. `linkHrefBuilder` signature `(session: UpcomingSessionItem) => string` matches between Task 2 (definition) and Task 5 (caller).

**Ambiguity check:** The spec explicitly says upcoming-sessions should render directly (not via `WidgetRenderer`) on the Throws Hub — Task 5 Step 5.2 shows the if-statement in the widget stack map that handles this. Other widgets go through `WidgetRenderer` as normal.

---

## Execution Handoff

Plan complete and ready to save. Two execution options:

1. **Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

The plan is 7 tasks across 4 commits. Subagent-driven works well for a plan this size because each task is self-contained with complete code.
