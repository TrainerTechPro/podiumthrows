# Edit Throw From History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount the existing `<EditThrowSheet>` on athlete history rows so athletes can edit/delete individual throws — fast-path on the best mark, sub-sheet for the full list.

**Architecture:** History aggregator captures per-throw data for `ThrowLog`-sourced drills only (`ThrowsBlockLog` and `AthleteDrillLog` stay read-only). Drill row gains two affordances: tap best-mark → edit best ThrowLog; tap "all N throws" → bottom Sheet listing every throw → tap → edit. Post-save, a callback bubbles up to `HistoryClient` to re-fetch.

**Tech Stack:** TypeScript, Next.js 14.2 App Router, React 18.3, Vitest + Testing Library, existing `<EditThrowSheet>`, existing `<Sheet>` primitive.

**Spec:** `docs/superpowers/specs/2026-05-01-edit-throw-from-history-design.md`

**Deviation from spec:** Spec mentions `router.refresh()` for post-save reload. Reality: `HistoryClient` is a client component that owns its own fetch state — `router.refresh()` won't re-run its fetch. We thread a `onDataChanged` callback prop down instead. This is more reliable and is the only deviation from the spec.

---

## File Map

**Modify:**

- `src/lib/throws/history-types.ts` — add `HistoryThrow` type, extend `HistoryDrill`
- `src/lib/throws/history.ts` — extend `ThrowLogInput`, populate new fields in aggregator
- `src/lib/throws/__tests__/history.test.ts` — extend fixtures + add new assertions
- `src/app/api/throws/history/route.ts` — narrow Prisma `select` so test fixtures and prod stay aligned
- `src/app/(dashboard)/athlete/throws/history/_history-drill-row.tsx` — convert to client component, add tap targets + state
- `src/app/(dashboard)/athlete/throws/history/_history-day-card.tsx` — thread `athleteId` and `onDataChanged` props
- `src/app/(dashboard)/athlete/throws/history/_history-client.tsx` — thread `athleteId` prop down, expose refetch as `onDataChanged`
- `src/app/(dashboard)/athlete/throws/history/page.tsx` — fetch athlete profile server-side, pass `athleteId` to `HistoryClient`
- `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx` — extend fixtures with new fields

**Create:**

- `src/app/(dashboard)/athlete/throws/history/_history-drill-throws-sheet.tsx` — new bottom Sheet listing throws
- `src/app/(dashboard)/athlete/throws/history/__tests__/history-drill-row.test.tsx` — new test file (didn't exist before)
- `src/app/(dashboard)/athlete/throws/history/__tests__/history-drill-throws-sheet.test.tsx` — new test file

**No schema changes. No new API endpoints. No new dependencies.**

---

## Task 1: Extend `HistoryDrill` types

**Files:**

- Modify: `src/lib/throws/history-types.ts`

- [ ] **Step 1: Add `HistoryThrow` type and extend `HistoryDrill`**

Open `src/lib/throws/history-types.ts` and replace the `HistoryDrill` block:

```ts
/** One individual throw inside a drill — only populated for ThrowLog-sourced drills. */
export type HistoryThrow = {
  id: string;
  throwNumber: number;
  distance: number | null;
  performedAt: string; // ISO datetime
  isCompetition: boolean;
  isFoul: boolean;
  notes: string | null;
  implementId: string | null;
  implementDisplayLabel: string;
};

/** One drill row inside an expanded day — shown to the user one per line. */
export type HistoryDrill = {
  source: "assigned" | "free";
  event: EventType;
  implementKg: number;
  implementLabel: string; // e.g. "7.26kg"
  drillType: string | null; // e.g. "FULL_THROW", "STANDING" — nullable for free logs
  drillTypeLabel: string | null; // e.g. "Full Throw" — display form
  throwCount: number;
  bestMark: number | null; // meters, nullable if no distance recorded
  isPersonalBest: boolean;
  /** ThrowLog id of the throw that produced bestMark. null when the drill is
   *  not ThrowLog-sourced (ThrowsBlockLog / AthleteDrillLog), or when no
   *  throw in the drill recorded a non-foul distance. */
  bestThrowLogId: string | null;
  /** Individual throws — populated only for ThrowLog-sourced drills.
   *  Empty for assigned blocks and AthleteDrillLog drills. */
  throws: HistoryThrow[];
};
```

- [ ] **Step 2: Run typecheck to surface every consumer that needs updating**

Run: `npx tsc --noEmit`
Expected: errors in `src/lib/throws/history.ts` (aggregator returns the old shape) and in `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx` (fixtures missing new fields). These are intentional and we'll fix them in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/throws/history-types.ts
git commit -m "$(cat <<'EOF'
feat(history): add HistoryThrow type + bestThrowLogId/throws fields

Extends HistoryDrill so the history loader can surface per-throw data
for ThrowLog-sourced drills. Read-only sources (ThrowsBlockLog,
AthleteDrillLog) will populate empty throws[] and null bestThrowLogId.

Tsc fails after this commit until the aggregator + fixtures catch up
in the next two tasks. Intentional — staged for review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend `ThrowLogInput` and populate `throws[]` + `bestThrowLogId` in the aggregator

**Files:**

- Modify: `src/lib/throws/history.ts`
- Test: `src/lib/throws/__tests__/history.test.ts`

- [ ] **Step 1: Write the failing test for free-log per-throw data**

Open `src/lib/throws/__tests__/history.test.ts` and add a new test inside the `describe("aggregateHistoryDays", ...)` block, after the existing tests:

```ts
it("populates per-throw data on free-log drills with bestThrowLogId pointing at the best non-foul throw", () => {
  const throwLogs = [
    {
      id: "t1",
      athleteId: "a1",
      event: "SHOT_PUT" as const,
      implementId: "imp_726",
      implementWeight: 7.26,
      distance: 18.42,
      date: new Date("2026-04-08T14:30:00Z"),
      isPersonalBest: true,
      isCompetition: false,
      isFoul: false,
      sessionId: null,
      throwNumber: 1,
      notes: "good rhythm",
    },
    {
      id: "t2",
      athleteId: "a1",
      event: "SHOT_PUT" as const,
      implementId: "imp_726",
      implementWeight: 7.26,
      distance: 19.1, // would be best, but...
      date: new Date("2026-04-08T14:35:00Z"),
      isPersonalBest: false,
      isCompetition: false,
      isFoul: true, // ...is a foul, so excluded from bestThrowLogId
      sessionId: null,
      throwNumber: 2,
      notes: null,
    },
    {
      id: "t3",
      athleteId: "a1",
      event: "SHOT_PUT" as const,
      implementId: "imp_726",
      implementWeight: 7.26,
      distance: 18.1,
      date: new Date("2026-04-08T14:40:00Z"),
      isPersonalBest: false,
      isCompetition: false,
      isFoul: false,
      sessionId: null,
      throwNumber: 3,
      notes: null,
    },
  ];

  const result = aggregateHistoryDays({ throwLogs, blockLogs: [] });
  const drill = result[0].drills[0];

  // bestMark is the highest distance regardless of foul (existing behavior preserved)
  expect(drill.bestMark).toBe(19.1);

  // bestThrowLogId is the highest non-foul distance — t1 (18.42), not t2 (foul)
  expect(drill.bestThrowLogId).toBe("t1");

  // throws[] contains all three, ordered by throwNumber ascending
  expect(drill.throws).toHaveLength(3);
  expect(drill.throws.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  expect(drill.throws[0].notes).toBe("good rhythm");
  expect(drill.throws[1].isFoul).toBe(true);
  expect(drill.throws[0].implementId).toBe("imp_726");
  expect(drill.throws[0].implementDisplayLabel).toBe(drill.implementLabel);
});

it("returns empty throws[] and null bestThrowLogId on assigned (ThrowsBlockLog) drills", () => {
  const blockLogs = [
    {
      id: "bl1",
      throwNumber: 1,
      distance: 18.0,
      implement: "7.26kg",
      assignment: {
        id: "asgn1",
        assignedDate: "2026-04-08",
        athleteId: "a1",
        status: "COMPLETED",
        session: { event: "SHOT_PUT" as const, name: "Comp prep" },
      },
      block: { blockType: "THROWING", config: '{"drillType":"FULL_THROW"}' },
    },
  ];
  const result = aggregateHistoryDays({ throwLogs: [], blockLogs });
  const drill = result[0].drills[0];

  expect(drill.source).toBe("assigned");
  expect(drill.bestThrowLogId).toBeNull();
  expect(drill.throws).toEqual([]);
});

it("returns empty throws[] and null bestThrowLogId on AthleteDrillLog (self-logged) drills", () => {
  const selfLoggedSessions = [
    {
      id: "sl1",
      event: "HAMMER" as const,
      date: "2026-04-09",
      drillLogs: [
        { drillType: "FULL_THROW", implementWeight: 7.26, throwCount: 12, bestMark: 66.87 },
      ],
    },
  ];
  const result = aggregateHistoryDays({ throwLogs: [], blockLogs: [], selfLoggedSessions });
  const drill = result[0].drills[0];

  expect(drill.bestThrowLogId).toBeNull();
  expect(drill.throws).toEqual([]);
});

it("returns null bestThrowLogId when every throw in the drill is a foul", () => {
  const throwLogs = [
    {
      id: "t1",
      athleteId: "a1",
      event: "SHOT_PUT" as const,
      implementId: null,
      implementWeight: 7.26,
      distance: 18.0,
      date: new Date("2026-04-08T14:30:00Z"),
      isPersonalBest: false,
      isCompetition: false,
      isFoul: true,
      sessionId: null,
      throwNumber: 1,
      notes: null,
    },
    {
      id: "t2",
      athleteId: "a1",
      event: "SHOT_PUT" as const,
      implementId: null,
      implementWeight: 7.26,
      distance: null, // distance-less throws also can't be "best"
      date: new Date("2026-04-08T14:35:00Z"),
      isPersonalBest: false,
      isCompetition: false,
      isFoul: false,
      sessionId: null,
      throwNumber: 2,
      notes: null,
    },
  ];
  const result = aggregateHistoryDays({ throwLogs, blockLogs: [] });
  const drill = result[0].drills[0];

  expect(drill.bestThrowLogId).toBeNull();
  expect(drill.throws).toHaveLength(2); // throws still surface for the sub-sheet
});
```

Also extend the existing fixtures in the file: any `throwLogs` array passed to `aggregateHistoryDays` needs `isFoul`, `throwNumber`, `notes`, `implementId` on each entry. Use `find` to locate them:

Run: `grep -n "implementWeight: 7.26\|implementWeight: 4.0" src/lib/throws/__tests__/history.test.ts`

For each existing ThrowLog fixture, add:

```ts
implementId: null,
isFoul: false,
throwNumber: 1, // or 2, 3, ... incrementing per throw in the drill
notes: null,
```

- [ ] **Step 2: Run tests to verify failures**

Run: `DATABASE_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx vitest run src/lib/throws/__tests__/history.test.ts --reporter=verbose 2>&1 | tail -40`

Expected: the four new tests fail with assertion errors on `bestThrowLogId` and `throws`. Existing tests fail with TypeScript errors about missing fields on the fixtures (we'll fix below).

- [ ] **Step 3: Extend `ThrowLogInput` and update the aggregator**

Open `src/lib/throws/history.ts`. Replace the `ThrowLogInput` type:

```ts
export type ThrowLogInput = {
  id: string;
  athleteId: string;
  event: EventType;
  implementId: string | null;
  implementWeight: number;
  distance: number | null;
  date: Date;
  isPersonalBest: boolean;
  isCompetition: boolean;
  isFoul: boolean;
  sessionId: string | null;
  throwNumber: number;
  notes: string | null;
};
```

Then update the free-log loop (currently around lines 130-157). Change the grouping data structure to also collect throws, then materialize the drill at the end. Replace the entire free-log section:

```ts
// Bucket free logs by their own date
// Group same-event/same-implement throws into one "drill row" for display density.
type FreeKey = string; // `${event}|${implementKg}|${date}`
type FreeAccumulator = {
  drill: HistoryDrill;
  rawThrows: ThrowLogInput[]; // collected for per-throw data + bestThrowLogId resolution
};
const freeGroups = new Map<FreeKey, FreeAccumulator>();

for (const log of input.throwLogs) {
  const date = isoDay(log.date, input.timezone);
  const key = `${log.event}|${log.implementWeight}|${date}`;
  const existing = freeGroups.get(key);
  if (existing) {
    existing.drill.throwCount += 1;
    if (
      log.distance != null &&
      (existing.drill.bestMark == null || log.distance > existing.drill.bestMark)
    ) {
      existing.drill.bestMark = log.distance;
    }
    if (log.isPersonalBest) existing.drill.isPersonalBest = true;
    existing.rawThrows.push(log);
  } else {
    freeGroups.set(key, {
      drill: {
        source: "free",
        event: log.event,
        implementKg: log.implementWeight,
        implementLabel: formatImplementDisplay(log.implementWeight, log.event, input.gender, {
          compact: true,
        }),
        drillType: null,
        drillTypeLabel: null,
        throwCount: 1,
        bestMark: log.distance ?? null,
        isPersonalBest: log.isPersonalBest,
        bestThrowLogId: null, // resolved after the loop
        throws: [], // populated after the loop
      },
      rawThrows: [log],
    });
  }
}

// Materialize throws[] and bestThrowLogId per free-log drill.
for (const acc of freeGroups.values()) {
  const sorted = [...acc.rawThrows].sort((a, b) => a.throwNumber - b.throwNumber);
  acc.drill.throws = sorted.map((t) => ({
    id: t.id,
    throwNumber: t.throwNumber,
    distance: t.distance,
    performedAt: t.date.toISOString(),
    isCompetition: t.isCompetition,
    isFoul: t.isFoul,
    notes: t.notes,
    implementId: t.implementId,
    implementDisplayLabel: acc.drill.implementLabel,
  }));

  // bestThrowLogId: highest non-foul distance. Tie-breaker: earliest performedAt.
  const candidates = sorted.filter((t) => !t.isFoul && t.distance != null);
  if (candidates.length > 0) {
    const max = candidates.reduce((a, b) =>
      (b.distance as number) > (a.distance as number)
        ? b
        : (b.distance as number) < (a.distance as number)
          ? a
          : b.date < a.date
            ? b
            : a
    );
    acc.drill.bestThrowLogId = max.id;
  }
}

for (const [key, acc] of freeGroups.entries()) {
  const date = key.split("|")[2];
  const bucket = buckets.get(date) ?? {
    date,
    drills: [],
    events: new Set<EventType>(),
    assignmentId: null,
    selfLoggedSessionId: null,
  };
  bucket.drills.push(acc.drill);
  bucket.events.add(acc.drill.event);
  buckets.set(date, bucket);
}
```

For the assigned-block loop (around lines 175-227), no per-throw data — just add the new fields when constructing the drill. Find the `blockGroups.set(key, { drill: { ... } })` block and add to the drill literal:

```ts
        bestThrowLogId: null,
        throws: [],
```

For the self-logged loop (around lines 261-301), same — find the `bucket.drills.push({ ... })` literal and add:

```ts
        bestThrowLogId: null,
        throws: [],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `DATABASE_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx vitest run src/lib/throws/__tests__/history.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: all tests pass (existing + 4 new).

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: errors only in `history-day-card.test.tsx` (fixtures still missing new fields) and possibly the API route if it `select`s narrowly. We'll fix those in Tasks 3 and 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/throws/history.ts src/lib/throws/__tests__/history.test.ts
git commit -m "$(cat <<'EOF'
feat(history): aggregator surfaces per-throw data on free-log drills

For ThrowLog-sourced drills, the aggregator now populates throws[]
(sorted by throwNumber ascending) and resolves bestThrowLogId to the
highest-distance non-foul throw, with earliest performedAt as the tie-
breaker. Foul-only and distance-less drills get throws[] but null
bestThrowLogId.

Assigned (ThrowsBlockLog) and self-logged (AthleteDrillLog) drills
get empty throws[] and null bestThrowLogId — they're aggregated
sources without individual ThrowLog ids. Multi-source edit is a
deferred follow-up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Narrow Prisma `select` on the history API route

**Files:**

- Modify: `src/app/api/throws/history/route.ts:90-99`

**Why:** The API currently does `prisma.throwLog.findMany({ where, orderBy })` with no select, which returns all fields. That works, but it's loose typing — a future field rename in the schema would silently change the wire shape. Add an explicit `select` so prod and test fixtures stay aligned.

- [ ] **Step 1: Replace the `throwLog.findMany` call**

Open `src/app/api/throws/history/route.ts`. Find the `prisma.throwLog.findMany` call (~line 90). Add a `select` block matching `ThrowLogInput`:

```ts
      prisma.throwLog.findMany({
        where: {
          athleteId: profile.id,
          date: { gte: startDate, ...(cursor ? { lt: endDate } : { lte: endDate }) },
          ...(events.length > 0 ? { event: { in: events } } : {}),
          ...(implementFilter.length > 0 ? { implementWeight: { in: implementFilter } } : {}),
          ...(prOnly ? { isPersonalBest: true } : {}),
        },
        select: {
          id: true,
          athleteId: true,
          event: true,
          implementId: true,
          implementWeight: true,
          distance: true,
          date: true,
          isPersonalBest: true,
          isCompetition: true,
          isFoul: true,
          sessionId: true,
          notes: true,
          attemptNumber: true,
        },
        orderBy: { date: "desc" },
      }),
```

Note: `ThrowLog.attemptNumber` (Int) is the schema field that corresponds to `throwNumber` in our domain types. Map it after the query. Find the `aggregateHistoryDays` call below (~line 157) and replace:

```ts
const allDays = aggregateHistoryDays({
  throwLogs: throwLogs.map((t) => ({
    id: t.id,
    athleteId: t.athleteId,
    event: t.event,
    implementId: t.implementId,
    implementWeight: t.implementWeight,
    distance: t.distance,
    date: t.date,
    isPersonalBest: t.isPersonalBest,
    isCompetition: t.isCompetition,
    isFoul: t.isFoul,
    sessionId: t.sessionId,
    throwNumber: t.attemptNumber ?? 0, // schema is attemptNumber, domain calls it throwNumber
    notes: t.notes,
  })),
  blockLogs,
  selfLoggedSessions,
  prContext,
  gender: profile.gender,
  timezone: tz,
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: only the day-card fixture errors remain (fixed in Task 6).

- [ ] **Step 3: Run the API integration test**

Run: `DATABASE_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx vitest run src/__tests__/api/throws/history.test.ts --reporter=verbose 2>&1 | tail -20`

Expected: all existing tests pass (we only narrowed the select; the wire shape is unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/throws/history/route.ts
git commit -m "$(cat <<'EOF'
chore(history): explicit Prisma select on /api/throws/history

The route previously selected all ThrowLog columns; explicit select
keeps the wire shape stable and surfaces schema-rename impact at
build time. Maps schema attemptNumber → domain throwNumber at the
boundary so the aggregator stays clean.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build `_history-drill-throws-sheet.tsx` (sub-sheet listing throws)

**Files:**

- Create: `src/app/(dashboard)/athlete/throws/history/_history-drill-throws-sheet.tsx`
- Test: `src/app/(dashboard)/athlete/throws/history/__tests__/history-drill-throws-sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/(dashboard)/athlete/throws/history/__tests__/history-drill-throws-sheet.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryDrillThrowsSheet } from "../_history-drill-throws-sheet";
import type { HistoryThrow } from "@/lib/throws/history-types";

const sampleThrows: HistoryThrow[] = [
  {
    id: "t1",
    throwNumber: 1,
    distance: 18.42,
    performedAt: "2026-04-08T14:30:00.000Z",
    isCompetition: false,
    isFoul: false,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
  {
    id: "t2",
    throwNumber: 2,
    distance: null,
    performedAt: "2026-04-08T14:35:00.000Z",
    isCompetition: false,
    isFoul: true,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
];

describe("HistoryDrillThrowsSheet", () => {
  it("renders one row per throw, in input order", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("shows distance for non-foul throws and a foul badge for fouls", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
    expect(screen.getByText(/FOUL/i)).toBeInTheDocument();
  });

  it("shows a PR star on the throw whose id matches bestThrowLogId", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    const stars = screen.getAllByLabelText(/personal best/i);
    expect(stars).toHaveLength(1);
  });

  it("calls onPickThrow with the tapped throw", () => {
    const onPickThrow = vi.fn();
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel="Full Throw"
        implementLabel="7.26kg"
        bestThrowLogId="t1"
        throws={sampleThrows}
        onPickThrow={onPickThrow}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /#1/i }));
    expect(onPickThrow).toHaveBeenCalledWith(sampleThrows[0]);
  });

  it("renders 'Free log' as the drill label when drillTypeLabel is null", () => {
    render(
      <HistoryDrillThrowsSheet
        open
        onClose={() => {}}
        drillTypeLabel={null}
        implementLabel="7.26kg"
        bestThrowLogId={null}
        throws={sampleThrows}
        onPickThrow={() => {}}
      />
    );
    expect(screen.getByText(/Free log · 7\.26kg/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/\(dashboard\)/athlete/throws/history/__tests__/history-drill-throws-sheet.test.tsx --reporter=verbose 2>&1 | tail -10`
Expected: FAIL with "Cannot find module '../\_history-drill-throws-sheet'"

- [ ] **Step 3: Implement the component**

Create `src/app/(dashboard)/athlete/throws/history/_history-drill-throws-sheet.tsx`:

```tsx
"use client";

import { Sheet } from "@/components/ui/Sheet";
import type { HistoryThrow } from "@/lib/throws/history-types";

export interface HistoryDrillThrowsSheetProps {
  open: boolean;
  onClose: () => void;
  drillTypeLabel: string | null;
  implementLabel: string;
  bestThrowLogId: string | null;
  throws: HistoryThrow[];
  onPickThrow: (t: HistoryThrow) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][d.getMonth()];
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${d.getDate()}, ${time}`;
}

export function HistoryDrillThrowsSheet({
  open,
  onClose,
  drillTypeLabel,
  implementLabel,
  bestThrowLogId,
  throws,
  onPickThrow,
}: HistoryDrillThrowsSheetProps) {
  const title = `${drillTypeLabel ?? "Free log"} · ${implementLabel}`;

  return (
    <Sheet open={open} onClose={onClose} side="bottom" size="lg" title={title} ariaLabel={title}>
      <ul className="divide-y divide-[var(--card-border)]">
        {throws.map((t) => {
          const isPR = t.id === bestThrowLogId;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPickThrow(t)}
                aria-label={`Edit throw #${t.throwNumber}`}
                className="w-full flex items-center gap-3 py-3 px-1 min-h-[44px] text-left active:scale-[0.99] motion-reduce:active:scale-100 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                <span className="font-mono tabular-nums text-sm font-semibold text-[var(--foreground)] w-10 shrink-0">
                  #{t.throwNumber}
                </span>
                <span className="text-xs text-muted shrink-0 w-32">
                  {formatTime(t.performedAt)}
                </span>
                <span className="font-mono tabular-nums text-base font-semibold text-[var(--foreground)] flex-1 text-right">
                  {t.distance != null ? `${t.distance.toFixed(2)}m` : "—"}
                </span>
                {t.isFoul && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-500/15 text-danger-500 tracking-wider shrink-0">
                    FOUL
                  </span>
                )}
                {isPR && (
                  <span className="text-primary-500 text-base shrink-0" aria-label="Personal best">
                    ★
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/\(dashboard\)/athlete/throws/history/__tests__/history-drill-throws-sheet.test.tsx --reporter=verbose 2>&1 | tail -15`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/history/_history-drill-throws-sheet.tsx src/app/\(dashboard\)/athlete/throws/history/__tests__/history-drill-throws-sheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(history): drill-throws sub-sheet listing every throw in a drill

Bottom Sheet rendering one tap-target row per throw — number, time,
distance, foul badge, PR star. Tap → onPickThrow(throw) so the parent
can mount EditThrowSheet. Stacking onto an existing Sheet (the day
card's content is one) is supported by the Sheet primitive.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `_history-drill-row.tsx` with tap targets + `<EditThrowSheet>`

**Files:**

- Modify: `src/app/(dashboard)/athlete/throws/history/_history-drill-row.tsx`
- Test: `src/app/(dashboard)/athlete/throws/history/__tests__/history-drill-row.test.tsx` (new file)

- [ ] **Step 1: Write the failing test for the drill row**

Create `src/app/(dashboard)/athlete/throws/history/__tests__/history-drill-row.test.tsx`:

```tsx
import React, { type ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import { HistoryDrillRow } from "../_history-drill-row";
import type { HistoryDrill, HistoryThrow } from "@/lib/throws/history-types";

// EditThrowSheet (rendered when best-mark is tapped) calls useToast(),
// which throws unless wrapped in ToastProvider.
function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const baseThrows: HistoryThrow[] = [
  {
    id: "t1",
    throwNumber: 1,
    distance: 18.42,
    performedAt: "2026-04-08T14:30:00.000Z",
    isCompetition: false,
    isFoul: false,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
  {
    id: "t2",
    throwNumber: 2,
    distance: 18.1,
    performedAt: "2026-04-08T14:35:00.000Z",
    isCompetition: false,
    isFoul: false,
    notes: null,
    implementId: "imp_726",
    implementDisplayLabel: "7.26 kg",
  },
];

const drillEditable: HistoryDrill = {
  source: "free",
  event: "SHOT_PUT",
  implementKg: 7.26,
  implementLabel: "7.26kg",
  drillType: null,
  drillTypeLabel: null,
  throwCount: 2,
  bestMark: 18.42,
  isPersonalBest: true,
  bestThrowLogId: "t1",
  throws: baseThrows,
};

describe("HistoryDrillRow", () => {
  it("renders best-mark as a button when bestThrowLogId is set", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    expect(screen.getByRole("button", { name: /Edit best throw/i })).toBeInTheDocument();
  });

  it("renders best-mark as static text when bestThrowLogId is null", () => {
    const drill = { ...drillEditable, bestThrowLogId: null };
    render(<HistoryDrillRow drill={drill} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.queryByRole("button", { name: /Edit best throw/i })).not.toBeInTheDocument();
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
  });

  it("renders 'all N throws' link when throws.length > 1", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    expect(screen.getByRole("button", { name: /all 2 throws/i })).toBeInTheDocument();
  });

  it("does not render 'all N throws' link for single-throw drills", () => {
    const drill = { ...drillEditable, throwCount: 1, throws: [baseThrows[0]] };
    render(<HistoryDrillRow drill={drill} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.queryByRole("button", { name: /all \d+ throws/i })).not.toBeInTheDocument();
  });

  it("shows 'all N throws' even when bestThrowLogId is null (foul-only drills)", () => {
    const foulOnly = {
      ...drillEditable,
      bestThrowLogId: null,
      throws: baseThrows.map((t) => ({ ...t, isFoul: true })),
    };
    render(<HistoryDrillRow drill={foulOnly} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.getByRole("button", { name: /all 2 throws/i })).toBeInTheDocument();
  });

  it("opens the throws sub-sheet when 'all N throws' is tapped", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /all 2 throws/i }));
    // sub-sheet renders rows
    expect(screen.getByRole("button", { name: /Edit throw #1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit throw #2/i })).toBeInTheDocument();
  });

  it("opens EditThrowSheet for the best throw when best-mark is tapped", () => {
    renderWithToast(
      <HistoryDrillRow drill={drillEditable} athleteId="ath_1" onDataChanged={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Edit best throw/i }));
    // EditThrowSheet renders an "Edit throw" title via the Sheet primitive
    expect(screen.getAllByText(/Edit throw/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/\(dashboard\)/athlete/throws/history/__tests__/history-drill-row.test.tsx --reporter=verbose 2>&1 | tail -15`
Expected: FAIL — current `HistoryDrillRow` doesn't accept `athleteId` or `onDataChanged`, doesn't render buttons.

- [ ] **Step 3: Rewrite `_history-drill-row.tsx` as a client component**

Replace the entire contents of `src/app/(dashboard)/athlete/throws/history/_history-drill-row.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { HistoryDrill, HistoryThrow } from "@/lib/throws/history-types";
import { EditThrowSheet, type EditableThrow } from "@/components/throws/EditThrowSheet";
import { HistoryDrillThrowsSheet } from "./_history-drill-throws-sheet";

interface Props {
  drill: HistoryDrill;
  athleteId: string;
  onDataChanged: () => void;
}

function toEditable(t: HistoryThrow, athleteId: string): EditableThrow {
  return {
    id: t.id,
    athleteId,
    implementId: t.implementId,
    implementDisplayLabel: t.implementDisplayLabel,
    distance: t.distance,
    date: t.performedAt,
    isCompetition: t.isCompetition,
    isFoul: t.isFoul,
    notes: t.notes,
  };
}

export function HistoryDrillRow({ drill, athleteId, onDataChanged }: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<HistoryThrow | null>(null);

  const label = drill.drillTypeLabel
    ? `${drill.drillTypeLabel} · ${drill.implementLabel}`
    : `Free log · ${drill.implementLabel}`;
  const best = drill.bestMark != null ? `${drill.bestMark.toFixed(2)}m` : "—";

  const bestThrow =
    drill.bestThrowLogId != null
      ? (drill.throws.find((t) => t.id === drill.bestThrowLogId) ?? null)
      : null;
  const showAllLink = drill.throws.length > 1;

  const handleSavedOrDeleted = () => {
    setEditing(null);
    setListOpen(false);
    onDataChanged();
  };

  return (
    <>
      <div
        className={`flex flex-col py-1.5 text-sm ${
          drill.isPersonalBest
            ? "text-[var(--foreground)]"
            : "text-surface-700 dark:text-surface-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="truncate">{label}</span>
          <span className="font-mono tabular-nums font-semibold flex items-center gap-1">
            <span>{drill.throwCount} · </span>
            {bestThrow ? (
              <button
                type="button"
                onClick={() => setEditing(bestThrow)}
                aria-label="Edit best throw"
                className="hover:underline focus-visible:underline focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100 transition-transform"
              >
                {best}
                {drill.isPersonalBest && (
                  <span className="text-primary-500 ml-1" aria-label="Personal best">
                    ★
                  </span>
                )}
              </button>
            ) : (
              <span>
                {best}
                {drill.isPersonalBest && (
                  <span className="text-primary-500 ml-1" aria-label="Personal best">
                    ★
                  </span>
                )}
              </span>
            )}
          </span>
        </div>
        {showAllLink && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="self-end mt-0.5 text-xs text-muted hover:text-primary-500 focus-visible:text-primary-500 focus-visible:outline-none transition-colors"
          >
            all {drill.throws.length} throws ›
          </button>
        )}
      </div>

      <HistoryDrillThrowsSheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        drillTypeLabel={drill.drillTypeLabel}
        implementLabel={drill.implementLabel}
        bestThrowLogId={drill.bestThrowLogId}
        throws={drill.throws}
        onPickThrow={(t) => setEditing(t)}
      />

      {editing && (
        <EditThrowSheet
          open={editing != null}
          onClose={() => setEditing(null)}
          side="bottom"
          initial={toEditable(editing, athleteId)}
          onSaved={handleSavedOrDeleted}
          onDeleted={handleSavedOrDeleted}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/\(dashboard\)/athlete/throws/history/__tests__/history-drill-row.test.tsx --reporter=verbose 2>&1 | tail -20`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/history/_history-drill-row.tsx src/app/\(dashboard\)/athlete/throws/history/__tests__/history-drill-row.test.tsx
git commit -m "$(cat <<'EOF'
feat(history): tap-to-edit affordances on drill rows

- Best-mark number becomes a button when bestThrowLogId is set →
  opens EditThrowSheet for the best throw.
- 'all N throws' link below the row (when throws.length > 1) opens
  the drill-throws sub-sheet → tap a throw → opens EditThrowSheet
  for that one.
- Foul-only drills with multiple throws still get the 'all N throws'
  link so the athlete can fix the foul flag.
- Read-only behavior preserved when bestThrowLogId is null and
  throws is empty (assigned blocks, AthleteDrillLog drills).
- Saves/deletes call onDataChanged → bubbles up to HistoryClient.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Thread `athleteId` and `onDataChanged` from page → HistoryClient → HistoryDayCard

**Files:**

- Modify: `src/app/(dashboard)/athlete/throws/history/page.tsx`
- Modify: `src/app/(dashboard)/athlete/throws/history/_history-client.tsx`
- Modify: `src/app/(dashboard)/athlete/throws/history/_history-day-card.tsx`
- Test: `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx`

- [ ] **Step 1: Update the day-card test fixtures + add athleteId/onDataChanged props**

Open `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx`. The existing fixture's drill is missing `bestThrowLogId` and `throws`. The component will be re-rendered with new props. Replace the test file contents:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryDayCard } from "../_history-day-card";
import type { HistoryDay } from "@/lib/throws/history-types";

const sampleDay: HistoryDay = {
  date: "2026-04-08",
  weekdayShort: "TUE",
  dateLabel: "Apr 8",
  events: ["SHOT_PUT"],
  totalThrows: 18,
  bestMarkOverall: 18.42,
  hasPR: true,
  drills: [
    {
      source: "free",
      event: "SHOT_PUT",
      implementKg: 7.26,
      implementLabel: "7.26kg",
      drillType: null,
      drillTypeLabel: null,
      throwCount: 18,
      bestMark: 18.42,
      isPersonalBest: true,
      bestThrowLogId: null, // legacy fixture — no per-throw data needed for these tests
      throws: [],
    },
  ],
  assignmentId: null,
  selfLoggedSessionId: null,
};

describe("HistoryDayCard", () => {
  it("renders collapsed with summary stats", () => {
    render(<HistoryDayCard day={sampleDay} athleteId="ath_1" onDataChanged={() => {}} />);
    expect(screen.getByText("TUE")).toBeInTheDocument();
    expect(screen.getByText("Apr 8")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Personal best/i)).toBeInTheDocument();
  });

  it("is not expanded by default", () => {
    render(<HistoryDayCard day={sampleDay} athleteId="ath_1" onDataChanged={() => {}} />);
    const btn = screen.getByRole("button", { name: /Tue.*Apr 8/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("expands when tapped and shows drill rows", () => {
    render(<HistoryDayCard day={sampleDay} athleteId="ath_1" onDataChanged={() => {}} />);
    const btn = screen.getByRole("button", { name: /Tue.*Apr 8/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Free log · 7\.26kg/)).toBeInTheDocument();
  });

  it("shows 'View full session' link when assigned", () => {
    const assignedDay: HistoryDay = { ...sampleDay, assignmentId: "asgn1" };
    render(<HistoryDayCard day={assignedDay} athleteId="ath_1" onDataChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Tue.*Apr 8/i }));
    expect(screen.getByRole("link", { name: /View full session/i })).toHaveAttribute(
      "href",
      "/athlete/throws/asgn1"
    );
  });

  it("shows 'Edit session' link for self-logged sessions", () => {
    const selfLoggedDay: HistoryDay = { ...sampleDay, selfLoggedSessionId: "sl1" };
    render(<HistoryDayCard day={selfLoggedDay} athleteId="ath_1" onDataChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Tue.*Apr 8/i }));
    expect(screen.getByRole("link", { name: /Edit session/i })).toHaveAttribute(
      "href",
      "/athlete/throws/log?edit=sl1"
    );
  });
});
```

- [ ] **Step 2: Update `_history-day-card.tsx` to thread the new props**

Open `src/app/(dashboard)/athlete/throws/history/_history-day-card.tsx`. Update the props interface and the `HistoryDrillRow` call site:

```tsx
interface Props {
  day: HistoryDay;
  athleteId: string;
  onDataChanged: () => void;
}

export function HistoryDayCard({ day, athleteId, onDataChanged }: Props) {
```

And the render block where drills are mapped:

```tsx
{
  day.drills.map((drill, idx) => (
    <HistoryDrillRow key={idx} drill={drill} athleteId={athleteId} onDataChanged={onDataChanged} />
  ));
}
```

- [ ] **Step 3: Update `_history-client.tsx` to accept athleteId and expose refetch**

Open `src/app/(dashboard)/athlete/throws/history/_history-client.tsx`. Three concrete changes:

1. Replace the `export function HistoryClient() {` line (line 68) with:

```tsx
interface HistoryClientProps {
  athleteId: string;
}

export function HistoryClient({ athleteId }: HistoryClientProps) {
```

2. Add a `refetch` callback after the `fetchHistory` useCallback block (insert immediately after the closing `}, [toastError]);` of `fetchHistory`, around line 135):

```tsx
// Re-fetch the first page. Used by EditThrowSheet save/delete callbacks
// bubbled up through HistoryDayCard → HistoryDrillRow.
const refetch = useCallback(() => {
  setDays([]);
  setNextCursor(null);
  setTotals(null);
  fetchHistory(filter);
}, [fetchHistory, filter]);
```

3. Find the existing line `<HistoryDayCard day={day} />` (around line 242) and replace it with:

```tsx
<HistoryDayCard day={day} athleteId={athleteId} onDataChanged={refetch} />
```

- [ ] **Step 4: Update `page.tsx` to fetch the athlete profile server-side**

Replace the contents of `src/app/(dashboard)/athlete/throws/history/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { HistoryClient } from "./_history-client";
import { ThrowsChipNav } from "../_chip-nav";

export const metadata = {
  title: "Throws History",
};

export default async function ThrowsHistoryPage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ThrowsChipNav />
      <HistoryClient athleteId={athlete.id} />
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck + lint + targeted tests**

Run all three:

```bash
npx tsc --noEmit
npx next lint --file src/app/\(dashboard\)/athlete/throws/history/_history-client.tsx --file src/app/\(dashboard\)/athlete/throws/history/_history-day-card.tsx --file src/app/\(dashboard\)/athlete/throws/history/_history-drill-row.tsx --file src/app/\(dashboard\)/athlete/throws/history/page.tsx --file src/app/\(dashboard\)/athlete/throws/history/_history-drill-throws-sheet.tsx
DATABASE_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx vitest run src/app/\(dashboard\)/athlete/throws/history/__tests__/ src/lib/throws/__tests__/history.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: tsc clean, lint clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/history/page.tsx src/app/\(dashboard\)/athlete/throws/history/_history-client.tsx src/app/\(dashboard\)/athlete/throws/history/_history-day-card.tsx src/app/\(dashboard\)/athlete/throws/history/__tests__/history-day-card.test.tsx
git commit -m "$(cat <<'EOF'
feat(history): thread athleteId + onDataChanged from page through to drill rows

- page.tsx fetches the AthleteProfile server-side and passes
  athleteId to HistoryClient.
- HistoryClient takes athleteId as a prop and exposes its first-page
  refetch as onDataChanged so EditThrowSheet save/delete bubbles up
  to refresh the history view (replaces router.refresh from the
  spec — HistoryClient owns its own client-side fetch state).
- HistoryDayCard threads both props down to each HistoryDrillRow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full verification + push

- [ ] **Step 1: Run full test suite**

```bash
DATABASE_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx vitest run --reporter=dot 2>&1 | tail -10
```

Expected: All tests pass (708 baseline + new tests added in this plan).

- [ ] **Step 2: Run typecheck + full lint**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
```

Expected: tsc clean, lint clean.

- [ ] **Step 3: Manual smoke test** (optional but recommended)

Start the dev server (`npm run dev`), log in as an athlete, navigate to `/athlete/throws/history`, expand a day with a free-log drill, and verify:

1. The best-mark number is tappable (visual: subtle hover underline on desktop) → opens EditThrowSheet pre-filled with the best throw.
2. "all N throws ›" link below the row → opens drill-throws sub-sheet listing every throw.
3. Tapping a throw in the sub-sheet → opens EditThrowSheet for that one (sub-sheet stays open underneath).
4. Editing distance + saving → toast fires, both sheets close, day card re-renders with the new bestMark.
5. Assigned-block days have NO edit affordance (best-mark stays static text, no "all N throws" link). No regression.

- [ ] **Step 4: Push**

```bash
git fetch origin && git log HEAD..origin/main --oneline
SKIP_E2E=1 git push 2>&1 | tail -8
```

Expected: All commits from this plan land on `origin/main`. Pre-push e2e is brittle (per `feedback_pre_push_e2e_brittle.md`) — `SKIP_E2E=1` is the documented escape when typecheck + lint pass.

---

## Out of Scope

These are NOT in this plan and should not be implemented:

- Multi-source `<EditThrowSheet>` (editing ThrowsBlockLog / AthleteDrillLog throws). The component is `ThrowLog`-only by design today; multi-source is a follow-up.
- Coach mirror — the coach-side `/coach/athletes/[id]/throws/history` (if it exists) would inherit this design but is a separate session.
- Optimistic UI — `onDataChanged` re-fetch is enough.
- Bulk edit/delete.
- Undo on delete.

## Verification — every spec section maps to a task

| Spec section                                               | Task                             |
| ---------------------------------------------------------- | -------------------------------- |
| 1.1 `HistoryThrow` type                                    | Task 1                           |
| 1.2 `HistoryDrill` extension                               | Task 1                           |
| 2 History builder                                          | Task 2                           |
| 3.1 `_history-drill-row.tsx`                               | Task 5                           |
| 3.2 `_history-drill-throws-sheet.tsx`                      | Task 4                           |
| 3.3 `_history-day-card.tsx` pass-through                   | Task 6                           |
| 4 Refresh strategy (revised: callback, not router.refresh) | Tasks 5 + 6                      |
| 5 Edge cases                                               | Covered by Task 2 + Task 5 tests |
| 6 Testing                                                  | Tasks 2, 4, 5, 6                 |
