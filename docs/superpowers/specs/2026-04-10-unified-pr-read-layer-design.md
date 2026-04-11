# Unified PR Read Layer — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Approach:** Canonical read-side service over existing fragmented PR stores

---

## Problem

Personal records are currently tracked in 7 different places in the codebase:

1. `ThrowLog.isPersonalBest` boolean flag (legacy, per-throw)
2. `ThrowsPR` dedicated table (auto-updated per athlete+event+implement)
3. `ThrowsDrillPR` table (per drill type)
4. `ProgramSession.bestMark` (Bondarchuk programs)
5. `AthleteDrillLog.bestMark` (self-logged sessions)
6. `AthleteProfile.competitionPRs` JSON field (coach-entered benchmarks)
7. `CoachPR` table (coach self-training — out of scope)

Each system operates independently with no sync between them. Users see inconsistent PR numbers across different screens — a throw might be marked as a PR in one view but a different view shows a larger historical throw. This destroys coach trust in the app.

The user's April 10 product feedback: *"If I put in like a throw with the 14 pound hammer at x distance, it might say that's a PR, but somewhere else I might have input that number, and I had a further PR."*

## Goals

1. **One canonical read path** — every screen that shows PRs calls a single helper that returns the same answer
2. **Competition PR vs practice best distinction** — per the user's feedback
3. **Competition weight only** — one PR per event, using the athlete's gender-correct competition implement
4. **Forgiving merge rule** — if multiple sources disagree, take the max (never lose data)
5. **No schema changes** — v1 is read-side only, no migrations, no write-path refactor

## Non-Goals

- Write-side consolidation (deprecating the old tables/flags) — that's a future project
- Per-implement-weight PR display — intentionally not supported in v1 per user's "one PR per event" choice
- Drill-level PR tracking — out of scope
- Team PR leaderboard rewrite — separate future task
- Caching beyond React per-request dedup

---

## Section 1: Canonical Data Shape

```typescript
export type AthletePRs = {
  athleteId: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  events: AthletePREvent[];
};

export type AthletePREvent = {
  event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
  competitionWeightKg: number;
  competitionPR: PRRecord | null;
  practiceBest: PRRecord | null;
  practiceExceedsPR: boolean;
};

export type PRRecord = {
  distance: number;
  date: string; // ISO date
  source: "THROWLOG" | "MANUAL_COMPETITION_JSON";
  throwLogId: string | null;
  notes: string | null;
};
```

**Design choices:**
- One entry per event (not per event+implement) — user chose this for simplicity
- Competition weight is resolved once per event from athlete's gender
- Both competition PR and practice best are always returned, either may be null
- `practiceExceedsPR` is pre-computed so display components don't do the comparison
- `source` field is transparent — UI can show a small "manually entered" indicator if needed
- `throwLogId` lets display components link to the originating throw (for video playback, detail view)

---

## Section 2: Merging Algorithm

Pseudocode for `getAthletePRs(athleteId: string): Promise<AthletePRs>`:

```
1. Fetch athlete profile:
   SELECT gender, events, competitionPRs FROM AthleteProfile WHERE id = athleteId

2. Resolve competition weights per event (from gender):
   - SHOT_PUT: MALE=7.26, FEMALE=4.0
   - DISCUS: MALE=2.0, FEMALE=1.0
   - HAMMER: MALE=7.26, FEMALE=4.0
   - JAVELIN: MALE=0.8, FEMALE=0.6
   - OTHER or null → fall back to MALE values (documented as a conscious choice)

3. Fetch all relevant ThrowLog rows in ONE query:
   SELECT id, event, implementWeight, distance, date, isCompetition, notes
   FROM ThrowLog
   WHERE athleteId = :athleteId
     AND event IN athlete.events
     AND distance IS NOT NULL
     AND implementWeight BETWEEN (competitionWeight - 0.05) AND (competitionWeight + 0.05)
   ORDER BY distance DESC

4. For each event the athlete has:
   a. Filter the ThrowLog rows to this event + tolerance-matched implement weight
   b. competitionPRCandidate = max distance among rows where isCompetition = true
   c. practiceBest = max distance among rows where isCompetition = false
   d. manualJSONValue = athlete.competitionPRs[event] (may be null/undefined/number)
   e. competitionPR = MAX(competitionPRCandidate, manualJSONValue)
      - Ties go to ThrowLog (richer metadata)
      - If manualJSONValue wins, source = "MANUAL_COMPETITION_JSON", throwLogId = null, date = athlete.updatedAt
      - If ThrowLog wins, source = "THROWLOG", throwLogId = row.id, date = row.date
   f. practiceExceedsPR = (practiceBest?.distance ?? 0) > (competitionPR?.distance ?? 0)

5. Return AthletePRs with events sorted by the order of athlete.events
```

### Edge Cases

| Case | Behavior |
|---|---|
| No throws and no manual JSON for event | `competitionPR = null`, `practiceBest = null`, event still appears in array |
| Only practice throws, no competitions | `competitionPR = null`, `practiceBest = {...}`. UI treats practice best as primary display. |
| Implement weight close but not exact (e.g., 7.3 vs 7.26) | Tolerance of 0.05kg — close enough counts |
| Athlete gender = OTHER or null | Falls back to MALE competition weights. Noted in spec as an intentional choice. |
| Competition throw at heavier implement (8kg hammer logged as isCompetition=true) | NOT considered a competition PR. Per the "competition weight only" rule. This is a deliberate product choice. |
| Multiple ThrowLog rows tied for the same max | First by date (most recent wins) |

---

## Section 3: Implementation

### New File: `src/lib/data/personal-records.ts`

```typescript
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Competition weights per gender (from src/lib/throws.ts)
const COMPETITION_WEIGHTS: Record<string, { male: number; female: number }> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};

const WEIGHT_TOLERANCE = 0.05; // kg

export type PRRecord = {
  distance: number;
  date: string;
  source: "THROWLOG" | "MANUAL_COMPETITION_JSON";
  throwLogId: string | null;
  notes: string | null;
};

export type AthletePREvent = {
  event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
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

function getCompetitionWeight(event: string, gender: string | null): number {
  const weights = COMPETITION_WEIGHTS[event];
  if (!weights) return 0;
  return gender === "FEMALE" ? weights.female : weights.male;
}

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

  const events = profile.events as Array<"SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN">;
  const manualPRs = (profile.competitionPRs as Record<string, number | null> | null) ?? {};

  // Fetch all throws for this athlete with near-competition-weight implements, in one query
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
    const competitionWeightKg = getCompetitionWeight(event, profile.gender);

    // Filter to this event + implement weight within tolerance
    const eventThrows = allThrows.filter(
      (t) =>
        t.event === event &&
        Math.abs(t.implementWeight - competitionWeightKg) < WEIGHT_TOLERANCE
    );

    // Helper: max by distance, ties broken by most recent date
    function pickBest<T extends { distance: number | null; date: Date }>(rows: T[]): T | null {
      if (rows.length === 0) return null;
      return rows.reduce((best, current) => {
        if (current.distance == null) return best;
        if (best.distance == null) return current;
        if (current.distance > best.distance) return current;
        if (current.distance === best.distance && current.date > best.date) return current;
        return best;
      });
    }

    // Best competition throw (isCompetition = true)
    const competitionThrows = eventThrows.filter((t) => t.isCompetition);
    const competitionBestRow = pickBest(competitionThrows);
    const competitionPRCandidate: PRRecord | null = competitionBestRow
      ? {
          distance: competitionBestRow.distance!,
          date: competitionBestRow.date.toISOString(),
          source: "THROWLOG",
          throwLogId: competitionBestRow.id,
          notes: competitionBestRow.notes,
        }
      : null;

    // Best practice throw (isCompetition = false)
    const practiceThrows = eventThrows.filter((t) => !t.isCompetition);
    const practiceBestRow = pickBest(practiceThrows);
    const practiceBest: PRRecord | null = practiceBestRow
      ? {
          distance: practiceBestRow.distance!,
          date: practiceBestRow.date.toISOString(),
          source: "THROWLOG",
          throwLogId: practiceBestRow.id,
          notes: practiceBestRow.notes,
        }
      : null;

    // Manual JSON override for competition PR
    const manualValue = manualPRs[event];
    let competitionPR: PRRecord | null = competitionPRCandidate;
    if (typeof manualValue === "number" && manualValue > 0) {
      const manualRecord: PRRecord = {
        distance: manualValue,
        date: profile.updatedAt.toISOString(),
        source: "MANUAL_COMPETITION_JSON",
        throwLogId: null,
        notes: null,
      };
      // MAX WINS: the larger of ThrowLog candidate and manual JSON value
      if (!competitionPR || manualValue > competitionPR.distance) {
        competitionPR = manualRecord;
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
    gender: profile.gender as "MALE" | "FEMALE" | "OTHER" | null,
    events: eventResults,
  };
});
```

### New API Route: `src/app/api/athletes/[athleteId]/personal-records/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAthletePRs } from "@/lib/data/personal-records";

export async function GET(
  request: NextRequest,
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

---

## Section 4: Call Site Migrations

Each existing PR read site is rewired one at a time. Each migration is small and independently testable.

| # | File | Current Behavior | New Behavior |
|---|---|---|---|
| M1 | `src/lib/data/coach.ts::getAthleteRecentPRs` | Returns last 5 ThrowLog rows with `isPersonalBest: true` | Wrap `getAthletePRs()` and return `AthletePREvent[]` (one PR per event) |
| M2 | `src/lib/data/dashboard.ts::fetchPRsData` | Merges ThrowLog + ProgramSession.bestMark + AthleteDrillLog.bestMark | Replace implementation with `getAthletePRs()` call. Signature may need to change — adapt callers if so. |
| M3 | `src/lib/data/dashboard-progress.ts::fetchPRTrackerData` | Groups ThrowLog PRs by (event, implementWeight) with +0.1m targets | Replace with `getAthletePRs()` — ignore implement grouping per the "one PR per event" choice. The "+0.1m target" becomes `competitionPR.distance + 0.1`. |
| M4 | `src/app/(dashboard)/athlete/profile/_tab-competition.tsx` | Reads `competitionGoals.competitionPR` and `seasonBest` | Call `getAthletePRs()` in the parent server component, pass result down. Note: `seasonBest` is a separate concept the canonical layer doesn't currently track — leave it alone or flag as future work. |
| M5 | `src/app/(dashboard)/athlete/review-profile/_review-client.tsx` | Reads `AthleteProfile.competitionPRs` JSON directly in the server component | Replace with `getAthletePRs()` result. The client component continues to consume a simple map shape (transform in the server page). |
| M6 | `src/app/(dashboard)/coach/athletes/[id]/page.tsx` | Calls `getAthleteRecentPRs` (covered by M1) | Inherits M1's rewrite. Verify display still looks right — may need minor UI tweaks since the shape changed. |

### NOT Migrating (Intentionally Left As-Is)

- **`checkAndSetPR()` in `src/lib/throws.ts`** — write side, not read side. Keeps setting `isPersonalBest` on ThrowLog rows for backward compat.
- **`ThrowsPR` / `ThrowsDrillPR` tables** — untouched. Future write-side consolidation task.
- **`getTeamPRLeaderboard()`** — stays as-is. Rewriting it requires product decisions about what "team PR leaderboard" means with the new PR model. Flagged as separate follow-up.
- **`ProgramSession.bestMark` display in Bondarchuk program UI** — program-specific, not general PR display.
- **Coach throw logging inline PR detection** (Task 4 of proxy profiles) — still runs, still sets `isPersonalBest`, still shows "New PR!" toast in the modal. The canonical layer reads independently of this flag.

---

## Section 5: Performance and Caching

- **Per-request cache:** `getAthletePRs` is wrapped in `React.cache()` so multiple server components on the same render pass share one result.
- **No persistent cache in v1:** PR data changes often (every logged throw). Cache invalidation would add complexity without clear benefit at current scale.
- **Query count:** 2 Prisma queries per athlete per request (profile select + throw log findMany). Deduplicated across the render pass.
- **Query shape:** Single `findMany` returning all throws for the athlete across all their events, filtered in JavaScript. This scales linearly with total throws per athlete — fine for up to several thousand throws. If it becomes a bottleneck later, move to per-event queries with `orderBy distance desc take 1` or a raw SQL window function.

---

## Section 6: Testing and Verification

### Manual Verification Cases

1. **Fresh athlete with no throws, no manual PRs:** Every event has `competitionPR: null`, `practiceBest: null`
2. **Athlete with only practice throws:** `competitionPR: null`, `practiceBest` populated
3. **Athlete with competition throw matching exactly the competition weight:** `competitionPR.source = "THROWLOG"`
4. **Athlete with manual PR entered by coach, no throws yet:** `competitionPR.source = "MANUAL_COMPETITION_JSON"`
5. **Athlete with both manual PR and ThrowLog competition throw — ThrowLog larger:** `competitionPR.source = "THROWLOG"`, ThrowLog value wins
6. **Athlete with both manual PR and ThrowLog competition throw — manual larger:** `competitionPR.source = "MANUAL_COMPETITION_JSON"`, manual wins
7. **Athlete with practice best exceeding competition PR:** `practiceExceedsPR = true`
8. **Male athlete's hammer competition weight = 7.26kg, female = 4.0kg** verified per-athlete
9. **Implement weight tolerance:** A throw at 7.3kg counts for men's hammer (within 0.05 tolerance), a throw at 7.5kg does not
10. **Heavy implement competition throw (e.g., 8kg hammer, isCompetition=true):** Does NOT count as competition PR (only competition weight counts)

### Migration Verification

For each call site migration (M1-M6), before/after comparison:
- Before: Note the PR numbers currently displayed on the screen
- After: Confirm the numbers match what `getAthletePRs()` returns for the same athlete
- Flag any cases where the new number differs from the old — this is expected for inconsistent athletes and confirms the canonical layer is fixing the bug

---

## Future Work (Explicitly Out of Scope)

1. **Write-side consolidation:** Deprecate `ThrowLog.isPersonalBest`, `ThrowsPR`, `ThrowsDrillPR`, `competitionPRs` JSON. Migrate to a single `PersonalRecord` table.
2. **Team PR leaderboard rewrite:** Update `getTeamPRLeaderboard` to use the canonical layer, deciding whether to show competition PRs, practice bests, or both.
3. **Per-implement-weight PR view:** A separate display that shows best per (event, implement) for training analytics. This is the "training bests" view intentionally excluded from the v1 canonical layer.
4. **Season PR tracking:** Best per season. Not in v1.
5. **Historical PR progression:** Chart showing PR over time. Uses the ThrowLog data directly — not blocked by this spec.
6. **Celebratory UI improvements:** PR toasts, confetti animations, etc. Consumes the canonical layer once it ships.
