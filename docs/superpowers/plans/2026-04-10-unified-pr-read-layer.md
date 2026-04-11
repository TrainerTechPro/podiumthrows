# Unified PR Read Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a canonical server-side helper `getAthletePRs()` that returns a unified PR view (competition PR + practice best per event), then migrate existing fragmented PR readers to use it — giving coaches and athletes consistent PR numbers across every screen.

**Architecture:** Single source helper at `src/lib/data/personal-records.ts`, wrapped with `React.cache()` for per-request deduplication. Queries ThrowLog filtered by gender-correct competition weight + tolerance, merges with `AthleteProfile.competitionPRs` JSON (max wins). A thin API route at `/api/athletes/[athleteId]/personal-records` exposes the same helper for client components. No schema changes. 6 call sites migrate one at a time, each independently testable.

**Tech Stack:** Next.js 14.2 App Router, Prisma, React Server Components, existing patterns from `src/lib/data/coach.ts`.

**Spec:** `docs/superpowers/specs/2026-04-10-unified-pr-read-layer-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/data/personal-records.ts` | Canonical `getAthletePRs()` helper + types (`AthletePRs`, `AthletePREvent`, `PRRecord`) |
| `src/app/api/athletes/[athleteId]/personal-records/route.ts` | GET endpoint exposing the helper to client contexts |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/lib/data/coach.ts` | `getAthleteRecentPRs` rewired to return `AthletePREvent[]` via new helper |
| `src/lib/data/dashboard.ts` | `fetchPRsData` internal rewire — same `PRItem[]` signature, new data source |
| `src/lib/data/dashboard-progress.ts` | `fetchPRTrackerData` rewired to use canonical layer — one row per event |
| `src/app/(dashboard)/coach/athletes/[id]/page.tsx` | Consumer of `getAthleteRecentPRs` — update to handle new shape |
| `src/app/(dashboard)/athlete/review-profile/page.tsx` | Use canonical layer instead of raw `competitionPRs` JSON |
| `src/app/(dashboard)/athlete/review-profile/_review-client.tsx` | Update props interface to accept new shape |

### Explicitly NOT Migrated (per spec)
- `src/app/(dashboard)/athlete/profile/_tab-competition.tsx` — form surface with richer shape (meet name, dates). Uses `competitionGoals`, not `competitionPRs`. Out of scope for v1.
- `src/lib/throws.ts::checkAndSetPR` — write side, stays as-is
- `ThrowsPR`, `ThrowsDrillPR` tables — untouched
- `getTeamPRLeaderboard()` — stays as-is
- `ProgramSession.bestMark` display — program-specific tracking

---

## Task 1: Create `personal-records.ts` Canonical Helper

**Files:**
- Create: `src/lib/data/personal-records.ts`

- [ ] **Step 1: Create the helper file**

Create `src/lib/data/personal-records.ts`:

```typescript
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Gender-correct competition weight per event (kg).
// Matches the values in src/lib/throws.ts.
const COMPETITION_WEIGHTS: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};

// Tolerance for matching implement weights (e.g. 7.3 counts as 7.26).
const WEIGHT_TOLERANCE_KG = 0.05;

export type PREventKey = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

export type PRRecord = {
  distance: number;
  date: string; // ISO timestamp
  source: "THROWLOG" | "MANUAL_COMPETITION_JSON";
  throwLogId: string | null;
  notes: string | null;
};

export type AthletePREvent = {
  event: PREventKey;
  competitionWeightKg: number;
  competitionPR: PRRecord | null;
  practiceBest: PRRecord | null;
  practiceExceedsPR: boolean;
};

export type AthletePRs = {
  athleteId: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  events: AthletePREvent[];
};

/**
 * Resolve the gender-correct competition weight for an event.
 * Defaults to male weights if gender is OTHER or null (documented choice).
 */
function getCompetitionWeight(event: string, gender: string | null): number {
  const weights = COMPETITION_WEIGHTS[event];
  if (!weights) return 0;
  return gender === "FEMALE" ? weights.female : weights.male;
}

/**
 * Canonical PR source for the entire app.
 *
 * Returns one AthletePREvent per event the athlete competes in.
 * Each entry contains:
 * - competitionPR: the best "competition weight" throw where isCompetition=true,
 *   OR the manual competitionPRs JSON value if it's larger (max wins).
 * - practiceBest: the best "competition weight" throw where isCompetition=false.
 * - practiceExceedsPR: true if practiceBest.distance > competitionPR.distance.
 *
 * Heavy/light implement throws are intentionally NOT surfaced here. The
 * canonical view is "one PR per event, competition weight only."
 *
 * Wrapped in React.cache for per-request deduplication.
 */
export const getAthletePRs = cache(async (athleteId: string): Promise<AthletePRs> => {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: {
      gender: true,
      events: true,
      competitionPRs: true,
      updatedAt: true,
    },
  });

  if (!profile) {
    return { athleteId, gender: null, events: [] };
  }

  const events = (profile.events as unknown as PREventKey[]) ?? [];
  const manualPRs =
    (profile.competitionPRs as Record<string, number | null> | null) ?? {};
  const profileGender = profile.gender as "MALE" | "FEMALE" | "OTHER" | null;

  // Single query for all throws across all events the athlete competes in.
  // Distance-present filter excludes quick-log throws without measured distance.
  const allThrows = await prisma.throwLog.findMany({
    where: {
      athleteId,
      event: { in: events },
      distance: { not: null },
    },
    select: {
      id: true,
      event: true,
      implementWeight: true,
      distance: true,
      date: true,
      isCompetition: true,
      notes: true,
    },
  });

  const eventResults: AthletePREvent[] = events.map((event) => {
    const competitionWeightKg = getCompetitionWeight(event, profileGender);

    // Filter to this event + implement weight within tolerance.
    const eventThrows = allThrows.filter(
      (t) =>
        t.event === event &&
        Math.abs(t.implementWeight - competitionWeightKg) < WEIGHT_TOLERANCE_KG
    );

    // Best row: max distance, ties broken by most recent date.
    function pickBest<
      T extends { distance: number | null; date: Date }
    >(rows: T[]): T | null {
      if (rows.length === 0) return null;
      return rows.reduce((best, current) => {
        if (current.distance == null) return best;
        if (best.distance == null) return current;
        if (current.distance > best.distance) return current;
        if (current.distance === best.distance && current.date > best.date) {
          return current;
        }
        return best;
      });
    }

    const competitionRow = pickBest(eventThrows.filter((t) => t.isCompetition));
    const competitionPRCandidate: PRRecord | null = competitionRow
      ? {
          distance: competitionRow.distance!,
          date: competitionRow.date.toISOString(),
          source: "THROWLOG",
          throwLogId: competitionRow.id,
          notes: competitionRow.notes,
        }
      : null;

    const practiceRow = pickBest(eventThrows.filter((t) => !t.isCompetition));
    const practiceBest: PRRecord | null = practiceRow
      ? {
          distance: practiceRow.distance!,
          date: practiceRow.date.toISOString(),
          source: "THROWLOG",
          throwLogId: practiceRow.id,
          notes: practiceRow.notes,
        }
      : null;

    // Max wins: compare ThrowLog competition PR candidate against manual JSON value.
    let competitionPR: PRRecord | null = competitionPRCandidate;
    const manualValue = manualPRs[event];
    if (typeof manualValue === "number" && manualValue > 0) {
      if (!competitionPR || manualValue > competitionPR.distance) {
        competitionPR = {
          distance: manualValue,
          date: profile.updatedAt.toISOString(),
          source: "MANUAL_COMPETITION_JSON",
          throwLogId: null,
          notes: null,
        };
      }
    }

    const practiceExceedsPR =
      practiceBest !== null &&
      (competitionPR === null || practiceBest.distance > competitionPR.distance);

    return {
      event,
      competitionWeightKg,
      competitionPR,
      practiceBest,
      practiceExceedsPR,
    };
  });

  return {
    athleteId,
    gender: profileGender,
    events: eventResults,
  };
});
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/personal-records.ts
git commit -m "feat: add canonical getAthletePRs helper with competition weight + JSON merge"
```

---

## Task 2: Create API Route

**Files:**
- Create: `src/app/api/athletes/[athleteId]/personal-records/route.ts`

- [ ] **Step 1: Create the route directory and file**

```bash
mkdir -p "src/app/api/athletes/[athleteId]/personal-records"
```

Create `src/app/api/athletes/[athleteId]/personal-records/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAthletePRs } from "@/lib/data/personal-records";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Athlete can read their own PRs
  if (session.role === "ATHLETE") {
    const ownProfile = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!ownProfile || ownProfile.id !== athleteId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
  } else if (session.role === "COACH") {
    // Coach can read PRs for any athlete they own
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 403 }
      );
    }
    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete not found" },
        { status: 404 }
      );
    }
  } else {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const prs = await getAthletePRs(athleteId);
  return NextResponse.json({ success: true, data: prs });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/athletes/[athleteId]/personal-records/"
git commit -m "feat: add GET /api/athletes/[athleteId]/personal-records endpoint"
```

---

## Task 3: Migrate `getAthleteRecentPRs` in `coach.ts`

**Files:**
- Modify: `src/lib/data/coach.ts` — function `getAthleteRecentPRs` (~line 1019)

Current behavior: returns `ThrowLogItem[]` — last 5 throws where `isPersonalBest: true`.

New behavior: returns `AthletePREvent[]` — one entry per event with competition PR + practice best.

- [ ] **Step 1: Add imports**

At the top of `src/lib/data/coach.ts`, add to the existing imports:

```typescript
import { getAthletePRs, type AthletePREvent } from "@/lib/data/personal-records";
```

- [ ] **Step 2: Replace the function implementation**

Find the existing `getAthleteRecentPRs` function (around line 1019) and replace it entirely with:

```typescript
/**
 * Returns the athlete's canonical PR set — one entry per event with
 * competition PR and practice best. Previously returned a flat list of
 * recent PR throws; now returns the per-event canonical view.
 *
 * The `limit` parameter is retained for API compatibility but ignored
 * (the canonical view is always per-event, not a rolling window).
 */
export async function getAthleteRecentPRs(
  athleteId: string,
  _limit = 5
): Promise<AthletePREvent[]> {
  const prs = await getAthletePRs(athleteId);
  return prs.events;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: errors in `src/app/(dashboard)/coach/athletes/[id]/page.tsx` about type mismatch on `recentPRs` — these will be fixed in Task 4. No errors in `coach.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/coach.ts
git commit -m "feat(coach): rewire getAthleteRecentPRs to return canonical per-event PR view"
```

---

## Task 4: Update Coach Athlete Detail Page Consumer

**Files:**
- Modify: `src/app/(dashboard)/coach/athletes/[id]/page.tsx` — the OverviewTab consumer of `recentPRs`

- [ ] **Step 1: Read the current consumer code**

Run: `grep -n "recentPRs\|getAthleteRecentPRs\|ThrowLogItem" "src/app/(dashboard)/coach/athletes/[id]/page.tsx"`

Note the existing usage. The current result unpacking looks like:
```typescript
const recentPRs = results[1].status === "fulfilled"
  ? results[1].value as ThrowLogItem[]
  : [] as ThrowLogItem[];
```

And the OverviewTab receives it as a prop.

- [ ] **Step 2: Update the result unpacking**

Replace the result unpacking with:

```typescript
const recentPRs = results[1].status === "fulfilled"
  ? (results[1].value as import("@/lib/data/personal-records").AthletePREvent[])
  : ([] as import("@/lib/data/personal-records").AthletePREvent[]);
```

Or add a proper import at the top of the file:

```typescript
import type { AthletePREvent } from "@/lib/data/personal-records";
```

and use `AthletePREvent[]` in place of `ThrowLogItem[]`.

- [ ] **Step 3: Update the OverviewTab component's recentPRs prop**

Find the OverviewTab component (it's defined in the same file or imported). Update its `recentPRs` prop type from `ThrowLogItem[]` to `AthletePREvent[]`.

Then update the rendering inside OverviewTab. The current code likely maps over recentPRs expecting fields like `{ id, event, distance, date, isCompetition }`. The new shape is:

```typescript
{
  event: "SHOT_PUT",
  competitionWeightKg: 7.26,
  competitionPR: { distance, date, source, throwLogId, notes } | null,
  practiceBest: { distance, date, source, throwLogId, notes } | null,
  practiceExceedsPR: boolean,
}
```

Update the rendering to show one row per event. Example render pattern:

```tsx
{recentPRs.length === 0 ? (
  <p className="text-sm text-[var(--muted)]">No PRs yet</p>
) : (
  <ul className="space-y-2">
    {recentPRs.map((pr) => {
      const primary = pr.competitionPR ?? pr.practiceBest;
      if (!primary) {
        return (
          <li key={pr.event} className="text-sm text-[var(--muted)]">
            {pr.event.replace("_", " ")}: —
          </li>
        );
      }
      return (
        <li key={pr.event} className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {pr.event.replace("_", " ")}
            {pr.competitionPR == null && (
              <span className="ml-1 text-xs text-[var(--muted)]">(practice)</span>
            )}
          </span>
          <span className="font-mono tabular-nums">
            {primary.distance}m
          </span>
          {pr.practiceExceedsPR && (
            <span className="text-xs text-[var(--muted)]">
              practice best: {pr.practiceBest!.distance}m
            </span>
          )}
        </li>
      );
    })}
  </ul>
)}
```

Adapt the styling to match the existing component. The key behavior: show one row per event, prefer competition PR when it exists, show "(practice)" label when only practice best exists, show a small hint when practice exceeds the competition PR.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/page.tsx"
git commit -m "feat(coach): update athlete detail overview to consume canonical PR shape"
```

---

## Task 5: Migrate `fetchPRsData` in `dashboard.ts`

**Files:**
- Modify: `src/lib/data/dashboard.ts` — function `fetchPRsData` (around line 571)

The consumers of `fetchPRsData` expect `PRItem[]` with `{ id, event, distance, date }`. We keep that signature but rewire the internals to use the canonical helper.

- [ ] **Step 1: Add import**

At the top of `src/lib/data/dashboard.ts`, add:

```typescript
import { getAthletePRs } from "@/lib/data/personal-records";
```

- [ ] **Step 2: Replace the function body**

Find `fetchPRsData` (around line 571) and replace it entirely with:

```typescript
export async function fetchPRsData(athleteId: string): Promise<PRItem[]> {
  const canonical = await getAthletePRs(athleteId);

  const items: PRItem[] = canonical.events
    .map((e) => {
      // Prefer competition PR; fall back to practice best if no competition throws yet.
      const primary = e.competitionPR ?? e.practiceBest;
      if (!primary) return null;
      return {
        id: primary.throwLogId ?? `manual-${e.event}`,
        event: e.event as string,
        distance: primary.distance,
        date: primary.date,
      };
    })
    .filter((x): x is PRItem => x !== null)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 4);

  return items;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard.ts
git commit -m "feat(dashboard): rewire fetchPRsData to use canonical PR layer"
```

---

## Task 6: Migrate `fetchPRTrackerData` in `dashboard-progress.ts`

**Files:**
- Modify: `src/lib/data/dashboard-progress.ts` — function `fetchPRTrackerData` (around line 174)

Current behavior: returns `{ rows: PRTrackerRow[] }` where each row is per `(event, implementWeight)`. New behavior: one row per event, implementWeight = competition weight.

- [ ] **Step 1: Add import**

At the top of `src/lib/data/dashboard-progress.ts`, add:

```typescript
import { getAthletePRs } from "@/lib/data/personal-records";
```

- [ ] **Step 2: Replace the function body**

Find `fetchPRTrackerData` (around line 174) and replace it entirely with:

```typescript
export async function fetchPRTrackerData(athleteId: string): Promise<PRTrackerData> {
  const canonical = await getAthletePRs(athleteId);

  const rows: PRTrackerRow[] = canonical.events
    .map((e) => {
      const primary = e.competitionPR ?? e.practiceBest;
      if (!primary) return null;
      const distance = primary.distance;
      return {
        throwLogId: primary.throwLogId ?? `manual-${e.event}`,
        event: e.event as string,
        implementWeight: e.competitionWeightKg,
        distance,
        date: primary.date,
        nextTargetDistance: Math.round((distance + NEXT_TARGET_DELTA_METERS) * 100) / 100,
      };
    })
    .filter((x): x is PRTrackerRow => x !== null);

  return { rows };
}
```

Note: `NEXT_TARGET_DELTA_METERS` is already defined in this file.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard-progress.ts
git commit -m "feat(dashboard): rewire fetchPRTrackerData to canonical per-event PR layer"
```

---

## Task 7: Migrate Athlete Review Profile to Canonical Layer

**Files:**
- Modify: `src/app/(dashboard)/athlete/review-profile/page.tsx`
- Modify: `src/app/(dashboard)/athlete/review-profile/_review-client.tsx`

The review page currently reads `AthleteProfile.competitionPRs` JSON directly and passes a `Record<string, number | null>` to the client. Migrate it to use the canonical layer.

- [ ] **Step 1: Update the Server Component**

In `src/app/(dashboard)/athlete/review-profile/page.tsx`:

Add the import:
```typescript
import { getAthletePRs } from "@/lib/data/personal-records";
```

Find where the page fetches profile data, and after the profile fetch, add:

```typescript
const canonicalPRs = await getAthletePRs(profile.id);
```

Then replace the `competitionPRs` prop passed to `ReviewProfileClient`. Current:

```typescript
<ReviewProfileClient
  profile={{
    // ...
    competitionPRs: (profile.competitionPRs as Record<string, number | null> | null) ?? null,
  }}
  // ...
/>
```

New:

```typescript
<ReviewProfileClient
  profile={{
    // ...
    // Pass canonical PRs instead of raw JSON
    canonicalPRs: canonicalPRs.events,
  }}
  // ...
/>
```

- [ ] **Step 2: Update the Client Component props**

In `src/app/(dashboard)/athlete/review-profile/_review-client.tsx`:

Replace the `Profile` interface's `competitionPRs` field:

```typescript
// Remove:
competitionPRs: Record<string, number | null> | null;

// Add at the top of the file:
import type { AthletePREvent } from "@/lib/data/personal-records";

// In the Profile interface:
canonicalPRs: AthletePREvent[];
```

- [ ] **Step 3: Update the rendering**

Find the existing competition PRs section (around line 194, the `hasPRs` check) and replace it with:

```tsx
{profile.canonicalPRs.some((e) => e.competitionPR || e.practiceBest) && (
  <section className="card p-5 space-y-3">
    <header className="flex items-center gap-2">
      <Trophy size={18} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
      <h2 className="font-heading text-base font-semibold">Competition PRs</h2>
    </header>
    <div className="grid grid-cols-2 gap-3 text-sm">
      {profile.canonicalPRs.map((e) => {
        const primary = e.competitionPR ?? e.practiceBest;
        if (!primary) return null;
        return (
          <div key={e.event}>
            <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
              {EVENT_LABELS[e.event] || e.event}
              {e.competitionPR == null && (
                <span className="ml-1 normal-case text-[var(--muted)]/70">(practice)</span>
              )}
            </div>
            <div className="font-mono tabular-nums text-lg text-primary-500">
              {primary.distance}m
            </div>
          </div>
        );
      })}
    </div>
  </section>
)}
```

Remove the old `hasPRs` const if it's no longer used.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/athlete/review-profile/"
git commit -m "feat(review-profile): use canonical PR layer instead of raw competitionPRs JSON"
```

---

## Task 8: Full Verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `npm run lint 2>&1 | grep -v "coach/questionnaires"`
Expected: No new errors. The pre-existing `coach/questionnaires/[id]/route.ts` errors on main are ignored (they exist before this work).

- [ ] **Step 3: Smoke test plan (manual)**

Test these flows in the browser once the branch is running:

- [ ] Coach views athlete detail page → "Recent PRs" section now shows one row per event (not a rolling window of recent PR throws)
- [ ] An athlete with only practice throws shows their practice best with a "(practice)" label
- [ ] An athlete with a competition throw shows their competition PR without the practice label
- [ ] An athlete with a coach-entered manual PR (via the profile edit form from proxy profiles Task 15) and no ThrowLog throws shows the manual value
- [ ] An athlete where ThrowLog competition throw > manual JSON: ThrowLog value wins
- [ ] An athlete where manual JSON > ThrowLog competition throw: manual JSON value wins
- [ ] The athlete dashboard PRs widget (`fetchPRsData` consumer) shows the same numbers as the coach detail page
- [ ] The athlete PR tracker widget (`fetchPRTrackerData` consumer) shows one row per event, not per implement weight
- [ ] The athlete review-profile page (after claim) shows the coach-populated PRs correctly
- [ ] Hitting `GET /api/athletes/{id}/personal-records` in the browser (as logged-in coach) returns the canonical shape
- [ ] Hitting the same endpoint for an athlete the coach doesn't own returns 404
- [ ] Athlete hitting their own PRs endpoint works; hitting another athlete's returns 403

- [ ] **Step 4: Final commit (if smoke test finds issues)**

```bash
git add -A
git commit -m "fix: address unified PR layer smoke test findings"
```

---

## Post-Implementation: Follow-Up Tasks (Future Work)

These are deliberately NOT part of this plan but should be tracked:

1. **Team PR Leaderboard rewrite** (`getTeamPRLeaderboard` in `coach.ts`) — needs product decisions about whether to show competition PRs, practice bests, or both.
2. **Per-implement-weight training bests view** — a separate analytics surface that shows best per (event, implement) for coaches who want the full training picture.
3. **Season PR tracking** — a `seasonBest` concept that resets each season.
4. **Write-side consolidation** — deprecate `ThrowLog.isPersonalBest`, `ThrowsPR`, `ThrowsDrillPR`, migrate to a unified `PersonalRecord` table.
5. **Tab Competition migration** — `_tab-competition.tsx` still reads `competitionGoals` with richer shape (meet name, date). Either extend the canonical layer to capture meet/date or leave as a separate form surface.
