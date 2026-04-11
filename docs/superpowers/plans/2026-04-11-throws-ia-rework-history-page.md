# Throws IA Rework + History Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the athlete-side throws navigation with 5 focused sub-pages (Today, Log, History, Trends, Readiness) and build the new History page that doesn't exist today.

**Architecture:** Each throws sub-page answers exactly one question. A new `/athlete/throws/history` route + `/api/throws/history` endpoint aggregates `ThrowLog` (free logs) and `ThrowsBlockLog` (assigned-session throws) into a day-grouped timeline. The existing `/analysis` and `/profile` routes are renamed to `/trends` and `/readiness` via file moves + Next.js 301 redirects. The sidebar `ATHLETE_NAV_SECTIONS` is restructured to nest the 5 throws sub-items under a single "Throws" section.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma (PostgreSQL), Zod v4, Vitest, Tailwind, custom component library, Chakra Petch/DM Sans/IBM Plex Mono typography.

**Source spec:** `docs/superpowers/specs/2026-04-11-throws-history-nav-rework-design.md`

**Dependencies:** Unified PR Read Layer (`docs/superpowers/specs/2026-04-10-unified-pr-read-layer-design.md`) — if not shipped at implementation time, fall back to `ThrowLog.isPersonalBest` with a TODO comment.

---

## Pre-work: Codebase verifications (no commit)

Before starting any task, verify these facts are still true. Each is a 1-line grep.

- [ ] **ThrowLog already has a composite index on `(athleteId, date)`** — confirmed at `prisma/schema.prisma:620`. No migration needed in this plan.
- [ ] **`parseBody` helper exists** at `src/lib/api-schemas.ts:750`.
- [ ] **`Sidebar.tsx` supports nested sub-items** — confirmed on the coach side at `src/components/ui/Sidebar.tsx:332-361` (Training → Throws Hub / Programming / Live Practice).
- [ ] **Vitest is the test runner** — confirmed at `package.json:14`. Test command: `npm test`.
- [ ] **Loading skeleton pattern** uses `Skeleton` and `SkeletonLine` from `@/components/ui/Skeleton` — see `src/app/(dashboard)/athlete/throws/log/loading.tsx` for reference.
- [ ] **API envelope** is `{ success: true, data: T }` / `{ success: false, error: string }` per CLAUDE.md Rule #2.

If any verification fails, stop and re-read the spec before continuing.

---

## File Structure Overview

**Files to create (new):**

```
src/lib/throws/
  history-types.ts                     # Shared types for history aggregation
  history.ts                            # Pure aggregation helper
  __tests__/history.test.ts             # Aggregation helper tests

src/lib/
  __tests__/api-schemas.test.ts         # parseQuery helper tests

src/app/api/throws/history/
  route.ts                              # GET /api/throws/history

src/__tests__/api/throws/
  history.test.ts                       # API route integration test

src/__tests__/nav/
  sidebar-resolution.test.ts            # Permanent regression guard

src/app/(dashboard)/athlete/throws/history/
  page.tsx                              # Server component wrapper
  loading.tsx                           # Shimmer skeleton
  _history-client.tsx                   # Client state manager
  _history-day-card.tsx                 # Single day card
  _history-drill-row.tsx                # Drill row inside expanded day
  _history-filter-chips.tsx             # Chip row
  _history-filter-sheet.tsx             # Generic bottom sheet (variant prop)
  _history-empty-state.tsx              # State 4: no-throws-ever
  _history-filters-empty-state.tsx      # State 3: filters-return-nothing
  _history-error-state.tsx              # State 5: fetch failed
  _history-week-divider.tsx             # Week separator

src/app/(dashboard)/athlete/throws/session/[id]/
  page.tsx                              # Read-only session view
```

**Files to modify:**

```
src/lib/api-schemas.ts                  # Add parseQuery helper
src/components/ui/Sidebar.tsx           # Restructure ATHLETE_NAV_SECTIONS
src/app/(dashboard)/athlete/throws/page.tsx      # Scope down to Today view
src/app/(dashboard)/athlete/throws/log/page.tsx  # Remove charts + past entries
next.config.mjs                         # Add redirects
```

**Files to move (git mv):**

```
src/app/(dashboard)/athlete/throws/analysis/  →  src/app/(dashboard)/athlete/throws/trends/
src/app/(dashboard)/athlete/throws/profile/   →  src/app/(dashboard)/athlete/throws/readiness/
```

---

## Task 1 — Rename `/analysis` → `/trends` and `/profile` → `/readiness`

**Files:**
- Move: `src/app/(dashboard)/athlete/throws/analysis/` → `src/app/(dashboard)/athlete/throws/trends/`
- Move: `src/app/(dashboard)/athlete/throws/profile/` → `src/app/(dashboard)/athlete/throws/readiness/`
- Modify: `next.config.mjs`

**Commit target:** `chore(throws): rename /analysis → /trends and /profile → /readiness with 301 redirects`

- [ ] **Step 1.1: Move `/analysis` directory to `/trends`**

```bash
git mv "src/app/(dashboard)/athlete/throws/analysis" "src/app/(dashboard)/athlete/throws/trends"
```

- [ ] **Step 1.2: Move `/profile` directory to `/readiness`**

```bash
git mv "src/app/(dashboard)/athlete/throws/profile" "src/app/(dashboard)/athlete/throws/readiness"
```

- [ ] **Step 1.3: Find all internal references to old paths**

Use the Grep tool:
- Pattern: `athlete/throws/analysis`, path: `src`
- Pattern: `athlete/throws/profile`, path: `src`

Expected: a list of files (imports, hrefs, breadcrumbs) that must be updated. Do NOT update `/athlete/profile` references — that's the main account profile, a different route.

- [ ] **Step 1.4: Update each found reference to the new path**

For each file the grep returned:
- Replace `athlete/throws/analysis` with `athlete/throws/trends`
- Replace `athlete/throws/profile` with `athlete/throws/readiness` (but NOT plain `athlete/profile`)

- [ ] **Step 1.5: Run typecheck to catch broken imports**

```bash
npm run typecheck
```

Expected: `0 errors` (warnings acceptable). If errors about missing modules referencing the old paths, fix them.

- [ ] **Step 1.6: Add redirects to `next.config.mjs`**

Read `next.config.mjs` first to preserve any existing `redirects()` array. Then add these two entries:

```js
// Inside module.exports (or const nextConfig):
async redirects() {
  return [
    // ... any existing redirects stay
    {
      source: '/athlete/throws/analysis',
      destination: '/athlete/throws/trends',
      permanent: true,
    },
    {
      source: '/athlete/throws/profile',
      destination: '/athlete/throws/readiness',
      permanent: true,
    },
  ];
},
```

If `redirects()` does not yet exist on the config, add it as a new key alongside existing keys.

- [ ] **Step 1.7: Verify redirects resolve**

```bash
npm run dev
# In another terminal:
curl -I http://localhost:3000/athlete/throws/analysis
curl -I http://localhost:3000/athlete/throws/profile
```

Expected: each returns `HTTP/1.1 308 Permanent Redirect` with a `location:` header pointing to the new URL. Stop dev server when confirmed.

- [ ] **Step 1.8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(throws): rename /analysis → /trends and /profile → /readiness

- git mv /analysis → /trends (clearer name, avoids collision with coach video-analysis)
- git mv /profile → /readiness (avoids collision with /athlete/profile)
- Add 301 redirects so old URLs keep working forever
- Update internal imports and links

Part of the throws IA rework (docs/superpowers/specs/2026-04-11-throws-history-nav-rework-design.md).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — History shared types

**Files:**
- Create: `src/lib/throws/history-types.ts`

**Commit target:** bundled with Task 5 (`feat(throws): /api/throws/history endpoint`)

- [ ] **Step 2.1: Create the types file**

```ts
// src/lib/throws/history-types.ts
import type { EventType } from "@prisma/client";

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
};

/** One day in the timeline — groups drills from both assigned and free sources. */
export type HistoryDay = {
  /** ISO date string, YYYY-MM-DD, in the athlete's local calendar */
  date: string;
  /** Pre-computed weekday abbreviation for display (e.g. "TUE") */
  weekdayShort: string;
  /** Pre-computed formatted date for display (e.g. "Apr 8") */
  dateLabel: string;
  /** Unique events that appear on this day (used for badge row) */
  events: EventType[];
  /** Total throws across all drills on this day */
  totalThrows: number;
  /** Best mark across all drills on this day (meters, nullable) */
  bestMarkOverall: number | null;
  /** True if any drill on this day was a PR */
  hasPR: boolean;
  /** All drills for this day, in the order the athlete logged them */
  drills: HistoryDrill[];
  /** Assignment ID if this day had an assigned session (for "View full session" link) */
  assignmentId: string | null;
};

/** Filter state from the client, sent as query params */
export type HistoryFilter = {
  range: "7d" | "30d" | "90d" | "ytd" | "all" | "custom";
  start: string | null; // ISO date, only when range=custom
  end: string | null;   // ISO date, only when range=custom
  events: EventType[];  // empty array = all events
  implementsKg: number[]; // empty array = all implements
  prOnly: boolean;
};

/** API response payload */
export type HistoryResponse = {
  days: HistoryDay[];
  nextCursor: string | null;
  totals: {
    sessions: number;
    throws: number;
  };
};
```

---

## Task 3 — History aggregation helper (TDD)

**Files:**
- Create: `src/lib/throws/history.ts`
- Create: `src/lib/throws/__tests__/history.test.ts`

**Commit target:** bundled with Task 5

- [ ] **Step 3.1: Write the failing test**

```ts
// src/lib/throws/__tests__/history.test.ts
import { describe, it, expect } from "vitest";
import { aggregateHistoryDays } from "../history";
import type { HistoryDay } from "../history-types";

describe("aggregateHistoryDays", () => {
  it("groups ThrowLog rows by date", () => {
    const throwLogs = [
      {
        id: "t1",
        athleteId: "a1",
        event: "SHOT_PUT" as const,
        implementWeight: 7.26,
        distance: 18.42,
        date: new Date("2026-04-08T14:30:00Z"),
        isPersonalBest: true,
        isCompetition: false,
        sessionId: null,
      },
      {
        id: "t2",
        athleteId: "a1",
        event: "SHOT_PUT" as const,
        implementWeight: 7.26,
        distance: 18.10,
        date: new Date("2026-04-08T14:35:00Z"),
        isPersonalBest: false,
        isCompetition: false,
        sessionId: null,
      },
    ];

    const result = aggregateHistoryDays({ throwLogs, blockLogs: [] });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-04-08");
    expect(result[0].totalThrows).toBe(2);
    expect(result[0].bestMarkOverall).toBe(18.42);
    expect(result[0].hasPR).toBe(true);
    expect(result[0].events).toEqual(["SHOT_PUT"]);
    expect(result[0].assignmentId).toBeNull();
  });

  it("aggregates assigned-session throws via their ThrowsAssignment.assignedDate", () => {
    const blockLogs = [
      {
        id: "bl1",
        throwNumber: 1,
        distance: 17.5,
        implement: "7.26kg",
        assignment: {
          id: "asgn1",
          assignedDate: "2026-04-07",
          athleteId: "a1",
          status: "COMPLETED",
          session: { event: "SHOT_PUT", name: "Heavy Day" },
        },
        block: { blockType: "THROWING", config: JSON.stringify({ drillType: "FULL_THROW" }) },
      },
    ];

    const result = aggregateHistoryDays({ throwLogs: [], blockLogs });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-04-07");
    expect(result[0].assignmentId).toBe("asgn1");
    expect(result[0].totalThrows).toBe(1);
    expect(result[0].drills[0].source).toBe("assigned");
  });

  it("merges same-day assigned and free logs into one HistoryDay", () => {
    const throwLogs = [
      {
        id: "t1",
        athleteId: "a1",
        event: "SHOT_PUT" as const,
        implementWeight: 8,
        distance: 16.2,
        date: new Date("2026-04-08T09:00:00Z"),
        isPersonalBest: false,
        isCompetition: false,
        sessionId: null,
      },
    ];
    const blockLogs = [
      {
        id: "bl1",
        throwNumber: 1,
        distance: 17.5,
        implement: "7.26kg",
        assignment: {
          id: "asgn1",
          assignedDate: "2026-04-08",
          athleteId: "a1",
          status: "COMPLETED",
          session: { event: "SHOT_PUT", name: "Heavy Day" },
        },
        block: { blockType: "THROWING", config: JSON.stringify({ drillType: "FULL_THROW" }) },
      },
    ];

    const result = aggregateHistoryDays({ throwLogs, blockLogs });

    expect(result).toHaveLength(1);
    expect(result[0].totalThrows).toBe(2);
    expect(result[0].drills).toHaveLength(2);
  });

  it("sorts days in reverse chronological order", () => {
    const throwLogs = [
      {
        id: "t1", athleteId: "a1", event: "SHOT_PUT" as const,
        implementWeight: 7.26, distance: 16, date: new Date("2026-04-01T12:00:00Z"),
        isPersonalBest: false, isCompetition: false, sessionId: null,
      },
      {
        id: "t2", athleteId: "a1", event: "SHOT_PUT" as const,
        implementWeight: 7.26, distance: 17, date: new Date("2026-04-08T12:00:00Z"),
        isPersonalBest: false, isCompetition: false, sessionId: null,
      },
      {
        id: "t3", athleteId: "a1", event: "SHOT_PUT" as const,
        implementWeight: 7.26, distance: 15, date: new Date("2026-04-05T12:00:00Z"),
        isPersonalBest: false, isCompetition: false, sessionId: null,
      },
    ];

    const result = aggregateHistoryDays({ throwLogs, blockLogs: [] });

    expect(result.map((d) => d.date)).toEqual(["2026-04-08", "2026-04-05", "2026-04-01"]);
  });

  it("returns empty array when no logs exist", () => {
    const result = aggregateHistoryDays({ throwLogs: [], blockLogs: [] });
    expect(result).toEqual<HistoryDay[]>([]);
  });
});
```

- [ ] **Step 3.2: Run test — expect failure**

```bash
npm test -- src/lib/throws/__tests__/history.test.ts
```

Expected: FAIL with `Cannot find module '../history'`.

- [ ] **Step 3.3: Implement the helper**

```ts
// src/lib/throws/history.ts
import type { EventType } from "@prisma/client";
import type { HistoryDay, HistoryDrill } from "./history-types";

// Narrow shapes — only the fields we read. Keeps tests lightweight.
export type ThrowLogInput = {
  id: string;
  athleteId: string;
  event: EventType;
  implementWeight: number;
  distance: number | null;
  date: Date;
  isPersonalBest: boolean;
  isCompetition: boolean;
  sessionId: string | null;
};

export type BlockLogInput = {
  id: string;
  throwNumber: number;
  distance: number | null;
  implement: string; // e.g. "7.26kg"
  assignment: {
    id: string;
    assignedDate: string; // ISO date string
    athleteId: string;
    status: string;
    session: { event: EventType; name: string };
  };
  block: { blockType: string; config: string };
};

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function isoDay(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10); // ISO date already
  return d.toISOString().slice(0, 10);
}

function labelsFor(isoDate: string): { weekdayShort: string; dateLabel: string } {
  // isoDate is YYYY-MM-DD; parse at local noon to dodge timezone edge cases.
  const d = new Date(`${isoDate}T12:00:00`);
  return {
    weekdayShort: WEEKDAY_SHORT[d.getDay()],
    dateLabel: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
  };
}

function parseImplementKg(label: string): number {
  const n = parseFloat(label);
  return Number.isFinite(n) ? n : 0;
}

function parseDrillTypeFromBlockConfig(configJson: string): { drillType: string | null; label: string | null } {
  try {
    const parsed = JSON.parse(configJson) as { drillType?: string };
    const drillType = parsed.drillType ?? null;
    if (!drillType) return { drillType: null, label: null };
    // Simple humanizer — real labels come from @/lib/throws/constants if imported server-side.
    const label = drillType
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { drillType, label };
  } catch {
    return { drillType: null, label: null };
  }
}

type DayBucket = {
  date: string;
  drills: HistoryDrill[];
  events: Set<EventType>;
  assignmentId: string | null;
};

export function aggregateHistoryDays(input: {
  throwLogs: ThrowLogInput[];
  blockLogs: BlockLogInput[];
}): HistoryDay[] {
  const buckets = new Map<string, DayBucket>();

  // Bucket free logs by their own date
  // Group same-event/same-implement throws into one "drill row" for display density.
  type FreeKey = string; // `${event}|${implementKg}|${date}`
  const freeGroups = new Map<FreeKey, HistoryDrill>();

  for (const log of input.throwLogs) {
    const date = isoDay(log.date);
    const key = `${log.event}|${log.implementWeight}|${date}`;
    const existing = freeGroups.get(key);
    if (existing) {
      existing.throwCount += 1;
      if (log.distance != null && (existing.bestMark == null || log.distance > existing.bestMark)) {
        existing.bestMark = log.distance;
      }
      if (log.isPersonalBest) existing.isPersonalBest = true;
    } else {
      freeGroups.set(key, {
        source: "free",
        event: log.event,
        implementKg: log.implementWeight,
        implementLabel: `${log.implementWeight}kg`,
        drillType: null,
        drillTypeLabel: null,
        throwCount: 1,
        bestMark: log.distance ?? null,
        isPersonalBest: log.isPersonalBest,
      });
    }
  }

  for (const [key, drill] of freeGroups.entries()) {
    const date = key.split("|")[2];
    const bucket = buckets.get(date) ?? {
      date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
    };
    bucket.drills.push(drill);
    bucket.events.add(drill.event);
    buckets.set(date, bucket);
  }

  // Bucket block logs by assignment.assignedDate
  // Group by (assignmentId, blockId) → one drill row per block.
  type BlockKey = string; // `${assignmentId}|${drillType}|${implement}`
  const blockGroups = new Map<BlockKey, { drill: HistoryDrill; date: string; assignmentId: string }>();

  for (const bl of input.blockLogs) {
    const date = bl.assignment.assignedDate;
    const event = bl.assignment.session.event;
    const drillInfo = parseDrillTypeFromBlockConfig(bl.block.config);
    const implementKg = parseImplementKg(bl.implement);
    const key = `${bl.assignment.id}|${drillInfo.drillType ?? "unknown"}|${bl.implement}`;

    const existing = blockGroups.get(key);
    if (existing) {
      existing.drill.throwCount += 1;
      if (bl.distance != null && (existing.drill.bestMark == null || bl.distance > existing.drill.bestMark)) {
        existing.drill.bestMark = bl.distance;
      }
    } else {
      blockGroups.set(key, {
        drill: {
          source: "assigned",
          event,
          implementKg,
          implementLabel: bl.implement,
          drillType: drillInfo.drillType,
          drillTypeLabel: drillInfo.label,
          throwCount: 1,
          bestMark: bl.distance ?? null,
          isPersonalBest: false, // assigned-side PR detection comes from Unified PR layer at render time
        },
        date,
        assignmentId: bl.assignment.id,
      });
    }
  }

  for (const { drill, date, assignmentId } of blockGroups.values()) {
    const bucket = buckets.get(date) ?? {
      date,
      drills: [],
      events: new Set<EventType>(),
      assignmentId: null,
    };
    bucket.drills.push(drill);
    bucket.events.add(drill.event);
    // If multiple assignments land on same day, we keep the first seen — UX choice.
    bucket.assignmentId = bucket.assignmentId ?? assignmentId;
    buckets.set(date, bucket);
  }

  // Flatten to HistoryDay[] with computed day-level stats, sorted desc.
  const days: HistoryDay[] = Array.from(buckets.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((bucket) => {
      const totalThrows = bucket.drills.reduce((sum, d) => sum + d.throwCount, 0);
      const bestMarkOverall = bucket.drills.reduce<number | null>((best, d) => {
        if (d.bestMark == null) return best;
        if (best == null) return d.bestMark;
        return d.bestMark > best ? d.bestMark : best;
      }, null);
      const hasPR = bucket.drills.some((d) => d.isPersonalBest);
      const labels = labelsFor(bucket.date);
      return {
        date: bucket.date,
        weekdayShort: labels.weekdayShort,
        dateLabel: labels.dateLabel,
        events: Array.from(bucket.events),
        totalThrows,
        bestMarkOverall,
        hasPR,
        drills: bucket.drills,
        assignmentId: bucket.assignmentId,
      };
    });

  return days;
}
```

- [ ] **Step 3.4: Run test — expect pass**

```bash
npm test -- src/lib/throws/__tests__/history.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 3.5: Do NOT commit yet — will be bundled with Task 5**

---

## Task 4 — Add `parseQuery` helper (TDD)

The spec references `parseQuery()`; it does not yet exist. Add it as a twin of `parseBody()`.

**Files:**
- Modify: `src/lib/api-schemas.ts`
- Create: `src/lib/__tests__/api-schemas.test.ts`

**Commit target:** bundled with Task 5

- [ ] **Step 4.1: Write failing test**

```ts
// src/lib/__tests__/api-schemas.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-schemas";

describe("parseQuery", () => {
  const Schema = z.object({
    range: z.enum(["7d", "30d", "all"]).default("30d"),
    prOnly: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),
  });

  it("parses valid query params into the schema", () => {
    const req = new Request("http://localhost/api/x?range=7d&prOnly=true");
    const result = parseQuery(req, Schema);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.range).toBe("7d");
      expect(result.prOnly).toBe(true);
    }
  });

  it("returns NextResponse(400) for invalid enum", () => {
    const req = new Request("http://localhost/api/x?range=bogus");
    const result = parseQuery(req, Schema);
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("applies defaults for missing params", () => {
    const req = new Request("http://localhost/api/x");
    const result = parseQuery(req, Schema);
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.range).toBe("30d");
      expect(result.prOnly).toBe(false);
    }
  });
});
```

- [ ] **Step 4.2: Run test — expect failure**

```bash
npm test -- src/lib/__tests__/api-schemas.test.ts
```

Expected: FAIL with `parseQuery is not exported from ...`.

- [ ] **Step 4.3: Add `parseQuery` to `src/lib/api-schemas.ts`**

Append directly below the existing `parseBody` function (around line 770-ish). Do not modify `parseBody`.

```ts
/**
 * Parse and validate URL query parameters against a Zod schema.
 * Returns the parsed data on success, or a 400 NextResponse on failure.
 *
 * Usage:
 * ```ts
 * const parsed = parseQuery(request, HistoryQuerySchema);
 * if (parsed instanceof NextResponse) return parsed;
 * const { range, prOnly } = parsed;
 * ```
 */
export function parseQuery<T>(
  request: Request,
  schema: z.ZodType<T>
): T | NextResponse {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    raw[k] = v;
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "_query",
      message: issue.message,
    }));
    return NextResponse.json(
      { success: false, error: "Invalid query parameters", details: fieldErrors },
      { status: 400 }
    );
  }

  return result.data;
}
```

- [ ] **Step 4.4: Run test — expect pass**

```bash
npm test -- src/lib/__tests__/api-schemas.test.ts
```

Expected: all 3 tests PASS.

---

## Task 5 — `/api/throws/history` route (TDD)

**Files:**
- Create: `src/app/api/throws/history/route.ts`
- Create: `src/__tests__/api/throws/history.test.ts`

**Commit target:** `feat(throws): /api/throws/history endpoint + aggregation helper`

- [ ] **Step 5.1: Write failing integration test**

Mock Prisma and the auth helpers so the test runs without a database. Focus on shape and filter handling, not full DB integration (that's e2e territory).

```ts
// src/__tests__/api/throws/history.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth and Prisma BEFORE importing the route.
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: vi.fn() },
    throwLog: { findMany: vi.fn() },
    throwsBlockLog: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET } from "@/app/api/throws/history/route";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

describe("GET /api/throws/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new Request("http://localhost/api/throws/history");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when user has no athlete profile", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new Request("http://localhost/api/throws/history");
    const res = await GET(req as never);
    expect(res.status).toBe(403);
  });

  it("returns empty days array when athlete has no logs", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });
    (prisma.throwLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.throwsBlockLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new Request("http://localhost/api/throws/history");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.days).toEqual([]);
    expect(body.data.totals.sessions).toBe(0);
    expect(body.data.totals.throws).toBe(0);
  });

  it("returns 400 for invalid range param", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });

    const req = new Request("http://localhost/api/throws/history?range=bogus");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("aggregates free logs and block logs into day rows", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });
    (prisma.throwLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "t1", athleteId: "a1", event: "SHOT_PUT", implementWeight: 7.26,
        distance: 18.42, date: new Date("2026-04-08T12:00:00Z"),
        isPersonalBest: true, isCompetition: false, sessionId: null,
      },
    ]);
    (prisma.throwsBlockLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new Request("http://localhost/api/throws/history?range=30d");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.days).toHaveLength(1);
    expect(body.data.days[0].date).toBe("2026-04-08");
    expect(body.data.totals.throws).toBe(1);
  });
});
```

- [ ] **Step 5.2: Run test — expect failure**

```bash
npm test -- src/__tests__/api/throws/history.test.ts
```

Expected: FAIL — `Cannot find module @/app/api/throws/history/route`.

- [ ] **Step 5.3: Create the route handler**

```ts
// src/app/api/throws/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseQuery } from "@/lib/api-schemas";
import { aggregateHistoryDays } from "@/lib/throws/history";

const EventEnum = z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]);

const HistoryQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "ytd", "all", "custom"]).default("30d"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  events: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(EventEnum)),
  implements: z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((n) => parseFloat(n)).filter((n) => Number.isFinite(n)) : []
    ),
  prOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
});

function rangeToStartDate(range: z.infer<typeof HistoryQuerySchema>["range"], start?: string): Date {
  const now = new Date();
  switch (range) {
    case "7d":  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ytd": return new Date(now.getFullYear(), 0, 1);
    case "all": return new Date(0); // epoch
    case "custom": return start ? new Date(`${start}T00:00:00`) : new Date(0);
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = parseQuery(request, HistoryQuerySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { range, start, end, events, implements: implementFilter, prOnly } = parsed;

    const profile = await prisma.athleteProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 403 });
    }

    const startDate = rangeToStartDate(range, start);
    const endDate = end ? new Date(`${end}T23:59:59`) : new Date();

    // Fetch both sources in parallel.
    const [throwLogs, blockLogs] = await Promise.all([
      prisma.throwLog.findMany({
        where: {
          athleteId: profile.id,
          date: { gte: startDate, lte: endDate },
          ...(events.length > 0 ? { event: { in: events } } : {}),
          ...(implementFilter.length > 0 ? { implementWeight: { in: implementFilter } } : {}),
          ...(prOnly ? { isPersonalBest: true } : {}),
        },
        orderBy: { date: "desc" },
      }),
      prisma.throwsBlockLog.findMany({
        where: {
          assignment: {
            athleteId: profile.id,
            assignedDate: { gte: startDate.toISOString().slice(0, 10), lte: endDate.toISOString().slice(0, 10) },
            status: { in: ["IN_PROGRESS", "COMPLETED"] },
            ...(events.length > 0 ? { session: { event: { in: events } } } : {}),
          },
        },
        include: {
          assignment: {
            select: {
              id: true,
              assignedDate: true,
              athleteId: true,
              status: true,
              session: { select: { event: true, name: true } },
            },
          },
          block: { select: { blockType: true, config: true } },
        },
      }),
    ]);

    const days = aggregateHistoryDays({ throwLogs, blockLogs });

    // Compute top-level totals (for filter summary line)
    const sessions = days.filter((d) => d.assignmentId != null).length;
    const throws = days.reduce((sum, d) => sum + d.totalThrows, 0);

    return NextResponse.json({
      success: true,
      data: {
        days,
        nextCursor: null, // Pagination deferred to Task 12 (follow-up)
        totals: { sessions, throws },
      },
    });
  } catch (error) {
    logger.error("GET /api/throws/history error", { context: "throws/history", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 5.4: Run test — expect pass**

```bash
npm test -- src/__tests__/api/throws/history.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5.5: Commit Tasks 2-5 together**

```bash
git add src/lib/throws/history-types.ts src/lib/throws/history.ts \
        src/lib/throws/__tests__/history.test.ts \
        src/lib/api-schemas.ts src/lib/__tests__/api-schemas.test.ts \
        src/app/api/throws/history/route.ts \
        src/__tests__/api/throws/history.test.ts
git commit -m "$(cat <<'EOF'
feat(throws): /api/throws/history endpoint with day-grouped aggregation

Adds a new GET /api/throws/history endpoint that aggregates ThrowLog (free logs)
and ThrowsBlockLog (assigned sessions) into a unified reverse-chronological
day timeline. Supports date range, event, implement, and PR-only filters.

Includes a new parseQuery helper (mirror of parseBody) for URL query validation.

Tests: aggregation helper (5 tests), API route (5 tests), parseQuery (3 tests).

Depends on Unified PR Read Layer spec for PR badges; falls back to
ThrowLog.isPersonalBest until that layer ships.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — History page UI: filter sheet (generic bottom sheet)

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/history/_history-filter-sheet.tsx`

**Commit target:** bundled with Task 11 (`feat(throws): new /athlete/throws/history page UI`)

- [ ] **Step 6.1: Check if a shared BottomSheet component already exists**

```bash
# Use Glob:
# pattern: src/components/ui/BottomSheet*
```

If it exists, use it. If not, proceed with a minimal local version scoped to the history page.

- [ ] **Step 6.2: Create `_history-filter-sheet.tsx`**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-filter-sheet.tsx
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type FilterVariant = "range" | "event" | "implement" | "pr";

interface Props {
  open: boolean;
  variant: FilterVariant;
  onClose: () => void;
  children: React.ReactNode;
}

export function HistoryFilterSheet({ open, variant, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus trap: on open, focus the close button so ESC works immediately.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Filter: ${variant}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        className={`relative w-full bg-[var(--card-bg)] border-t border-[var(--card-border)] rounded-t-2xl p-5 pb-8 max-h-[75vh] overflow-y-auto ${
          prefersReducedMotion ? "" : "animate-slide-up-sheet"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section font-heading text-[var(--foreground)]">Filter</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-2 -m-2 text-muted hover:text-[var(--foreground)]"
            aria-label="Close filter"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

Note: the `animate-slide-up-sheet` class may need to be added to `tailwind.config.ts` keyframes if it doesn't exist. If it doesn't, use `animate-spring-up` which is referenced in CLAUDE.md as an existing class.

- [ ] **Step 6.3: Manually verify it renders (no test yet; will be covered by integration test)**

No commit yet — bundled with Task 11.

---

## Task 7 — History page UI: drill row, week divider, empty states

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/history/_history-drill-row.tsx`
- Create: `src/app/(dashboard)/athlete/throws/history/_history-week-divider.tsx`
- Create: `src/app/(dashboard)/athlete/throws/history/_history-empty-state.tsx`
- Create: `src/app/(dashboard)/athlete/throws/history/_history-filters-empty-state.tsx`
- Create: `src/app/(dashboard)/athlete/throws/history/_history-error-state.tsx`

**Commit target:** bundled with Task 11

- [ ] **Step 7.1: Create `_history-drill-row.tsx`**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-drill-row.tsx
import type { HistoryDrill } from "@/lib/throws/history-types";

interface Props {
  drill: HistoryDrill;
}

export function HistoryDrillRow({ drill }: Props) {
  const label = drill.drillTypeLabel
    ? `${drill.drillTypeLabel} · ${drill.implementLabel}`
    : `Free log · ${drill.implementLabel}`;
  const best = drill.bestMark != null ? `${drill.bestMark.toFixed(2)}m` : "—";

  return (
    <div
      className={`flex items-center justify-between py-1.5 text-sm font-mono tabular-nums ${
        drill.isPersonalBest ? "text-[var(--foreground)]" : "text-surface-700 dark:text-surface-300"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="font-semibold">
        {drill.throwCount} · {best}
        {drill.isPersonalBest && <span className="text-primary-500 ml-1" aria-label="Personal best">★</span>}
      </span>
    </div>
  );
}
```

- [ ] **Step 7.2: Create `_history-week-divider.tsx`**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-week-divider.tsx
interface Props {
  label: string; // e.g. "Week of Mar 31"
}

export function HistoryWeekDivider({ label }: Props) {
  return (
    <div
      className="flex items-center gap-3 py-3 text-xs font-mono text-muted uppercase tracking-wider"
      role="separator"
      aria-label={label}
    >
      <span className="flex-1 h-px bg-[var(--card-border)]" />
      <span>{label}</span>
      <span className="flex-1 h-px bg-[var(--card-border)]" />
    </div>
  );
}
```

- [ ] **Step 7.3: Create `_history-empty-state.tsx` (State 4 — no throws ever)**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-empty-state.tsx
import Link from "next/link";
import { Target } from "lucide-react";

export function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
        <Target size={28} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
      </div>
      <h2 className="text-section font-heading text-[var(--foreground)]">No throws yet</h2>
      <p className="text-sm text-surface-700 dark:text-surface-300 mt-2 max-w-xs">
        Log your first throw to start building your history. Every rep matters.
      </p>
      <Link
        href="/athlete/throws/log"
        className="mt-6 inline-flex items-center px-6 py-3 rounded-xl bg-primary-500 text-black font-heading font-bold tracking-wide hover:bg-primary-400 transition-colors"
      >
        LOG A THROW
      </Link>
    </div>
  );
}
```

- [ ] **Step 7.4: Create `_history-filters-empty-state.tsx` (State 3 — filters return nothing)**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-filters-empty-state.tsx
import { Filter } from "lucide-react";

interface Props {
  onClear: () => void;
}

export function HistoryFiltersEmptyState({ onClear }: Props) {
  return (
    <div className="card card-interactive text-center py-10 px-6">
      <Filter size={24} strokeWidth={1.75} className="text-muted mx-auto mb-3" aria-hidden="true" />
      <h3 className="font-semibold text-[var(--foreground)]">No throws match these filters</h3>
      <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
        Try a wider date range or different events
      </p>
      <button
        onClick={onClear}
        className="mt-4 px-5 py-2 rounded-lg bg-primary-500/15 text-primary-500 text-sm font-semibold hover:bg-primary-500/25 transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}
```

- [ ] **Step 7.5: Create `_history-error-state.tsx` (State 5 — fetch failed)**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-error-state.tsx
import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
  onRetry: () => void;
}

export function HistoryErrorState({ message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="card text-center py-10 px-6 border border-red-500/30 bg-red-500/5"
    >
      <AlertTriangle
        size={24}
        strokeWidth={1.75}
        className="text-red-400 mx-auto mb-3"
        aria-hidden="true"
      />
      <h3 className="font-semibold text-[var(--foreground)]">Couldn&rsquo;t load history</h3>
      <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 px-5 py-2 rounded-lg bg-primary-500/15 text-primary-500 text-sm font-semibold hover:bg-primary-500/25 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 7.6: No commit yet — bundled with Task 11**

---

## Task 8 — History page UI: day card (TDD for expand/collapse)

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/history/_history-day-card.tsx`
- Create: `src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx`

**Commit target:** bundled with Task 11

- [ ] **Step 8.1: Write failing test**

```tsx
// src/app/(dashboard)/athlete/throws/history/__tests__/history-day-card.test.tsx
import { describe, it, expect, vi } from "vitest";
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
    },
  ],
  assignmentId: null,
};

describe("HistoryDayCard", () => {
  it("renders collapsed with summary stats", () => {
    render(<HistoryDayCard day={sampleDay} />);
    expect(screen.getByText("TUE")).toBeInTheDocument();
    expect(screen.getByText("Apr 8")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText(/18\.42/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Personal best/i)).toBeInTheDocument();
  });

  it("is not expanded by default", () => {
    render(<HistoryDayCard day={sampleDay} />);
    const btn = screen.getByRole("button", { name: /Tue.*Apr 8/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("expands when tapped and shows drill rows", () => {
    render(<HistoryDayCard day={sampleDay} />);
    const btn = screen.getByRole("button", { name: /Tue.*Apr 8/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Free log · 7\.26kg/)).toBeInTheDocument();
  });

  it("shows 'View full session' link when assigned", () => {
    const assignedDay: HistoryDay = { ...sampleDay, assignmentId: "asgn1" };
    render(<HistoryDayCard day={assignedDay} />);
    fireEvent.click(screen.getByRole("button", { name: /Tue.*Apr 8/i }));
    expect(screen.getByRole("link", { name: /View full session/i })).toHaveAttribute(
      "href",
      "/athlete/throws/session/asgn1"
    );
  });
});
```

- [ ] **Step 8.2: Run test — expect failure**

```bash
npm test -- src/app/\(dashboard\)/athlete/throws/history/__tests__/history-day-card.test.tsx
```

Expected: FAIL — `Cannot find module '../_history-day-card'`.

- [ ] **Step 8.3: Implement the day card**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-day-card.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { HistoryDay } from "@/lib/throws/history-types";
import { HistoryDrillRow } from "./_history-drill-row";

// Event badge colors — match the existing /log constants.
const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "#E85D26",
  DISCUS: "#2563EB",
  HAMMER: "#7C3AED",
  JAVELIN: "#059669",
};

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

interface Props {
  day: HistoryDay;
}

export function HistoryDayCard({ day }: Props) {
  const [expanded, setExpanded] = useState(false);
  const best = day.bestMarkOverall != null ? `${day.bestMarkOverall.toFixed(2)}m` : null;

  return (
    <div className={`card ${expanded ? "border-primary-500/30" : ""}`}>
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        aria-label={`${day.weekdayShort} ${day.dateLabel} — ${day.totalThrows} throws`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-muted uppercase tracking-wider">
              {day.weekdayShort}
            </span>
          </div>
          <div className="text-base font-heading font-semibold text-[var(--foreground)] mt-0.5">
            {day.dateLabel}
          </div>

          <div className="flex gap-1 mt-2">
            {day.events.map((ev) => (
              <span
                key={ev}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white tracking-wide"
                style={{ backgroundColor: EVENT_COLORS[ev] || "#666" }}
              >
                {EVENT_LABELS[ev] || ev}
              </span>
            ))}
          </div>

          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-sm text-surface-700 dark:text-surface-300">
              <span className="font-mono font-semibold text-[var(--foreground)] tabular-nums">
                {day.totalThrows}
              </span>{" "}
              throws
            </span>
            {best && (
              <span className="text-sm text-surface-700 dark:text-surface-300">
                Best{" "}
                <span className="font-mono font-semibold text-[var(--foreground)] tabular-nums">
                  {best}
                </span>
              </span>
            )}
            {day.hasPR && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded bg-primary-500/15 text-primary-500 inline-flex items-center gap-1"
                aria-label="Personal best"
              >
                ★ PR
              </span>
            )}
          </div>
        </div>

        <ChevronRight
          size={18}
          strokeWidth={1.75}
          className={`text-muted mt-1 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-[var(--card-border)] px-4 py-3 space-y-1">
          {day.drills.map((drill, idx) => (
            <HistoryDrillRow key={idx} drill={drill} />
          ))}
          {day.assignmentId && (
            <Link
              href={`/athlete/throws/session/${day.assignmentId}`}
              className="mt-2 block text-center py-2 px-3 rounded-lg bg-primary-500/10 text-primary-500 text-sm font-semibold hover:bg-primary-500/20 transition-colors"
            >
              View full session →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.4: Run test — expect pass**

```bash
npm test -- src/app/\(dashboard\)/athlete/throws/history/__tests__/history-day-card.test.tsx
```

Expected: all 4 tests PASS.

---

## Task 9 — History page UI: filter chips

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/history/_history-filter-chips.tsx`

**Commit target:** bundled with Task 11

- [ ] **Step 9.1: Create the filter chip row**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-filter-chips.tsx
"use client";

import { ChevronDown } from "lucide-react";
import type { HistoryFilter } from "@/lib/throws/history-types";
import type { FilterVariant } from "./_history-filter-sheet";

const RANGE_LABELS: Record<HistoryFilter["range"], string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  ytd: "Year to date",
  all: "All time",
  custom: "Custom",
};

interface Props {
  filter: HistoryFilter;
  onOpen: (variant: FilterVariant) => void;
  onClear: () => void;
  hasAnyActive: boolean;
}

export function HistoryFilterChips({ filter, onOpen, onClear, hasAnyActive }: Props) {
  const rangeLabel = RANGE_LABELS[filter.range];
  const eventLabel =
    filter.events.length === 0 ? "Event" : filter.events.length === 1 ? filter.events[0] : `${filter.events.length} events`;
  const implementLabel =
    filter.implementsKg.length === 0
      ? "Implement"
      : filter.implementsKg.length === 1
        ? `${filter.implementsKg[0]}kg`
        : `${filter.implementsKg.length} impl`;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      <FilterChip active={filter.range !== "30d"} onClick={() => onOpen("range")}>
        {rangeLabel}
      </FilterChip>
      <FilterChip active={filter.events.length > 0} onClick={() => onOpen("event")}>
        {eventLabel}
      </FilterChip>
      <FilterChip active={filter.implementsKg.length > 0} onClick={() => onOpen("implement")}>
        {implementLabel}
      </FilterChip>
      <FilterChip
        active={filter.prOnly}
        pr
        onClick={() => onOpen("pr")}
      >
        ★ PR
      </FilterChip>
      {hasAnyActive && (
        <button
          onClick={onClear}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs text-muted hover:text-[var(--foreground)] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function FilterChip({
  active,
  pr,
  onClick,
  children,
}: {
  active: boolean;
  pr?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
        active
          ? pr
            ? "bg-primary-500/15 border-primary-500/40 text-primary-500"
            : "bg-primary-500/15 border-primary-500/40 text-primary-500"
          : "bg-surface-100 dark:bg-surface-800 border-[var(--card-border)] text-surface-700 dark:text-surface-300 hover:border-[var(--card-border)]"
      }`}
    >
      {children}
      {!pr && <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
```

---

## Task 10 — History page UI: client state manager

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/history/_history-client.tsx`

**Commit target:** bundled with Task 11

- [ ] **Step 10.1: Create the client component**

```tsx
// src/app/(dashboard)/athlete/throws/history/_history-client.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { HistoryDay, HistoryFilter, HistoryResponse } from "@/lib/throws/history-types";
import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";
import { HistoryDayCard } from "./_history-day-card";
import { HistoryFilterChips } from "./_history-filter-chips";
import { HistoryFilterSheet, type FilterVariant } from "./_history-filter-sheet";
import { HistoryWeekDivider } from "./_history-week-divider";
import { HistoryEmptyState } from "./_history-empty-state";
import { HistoryFiltersEmptyState } from "./_history-filters-empty-state";
import { HistoryErrorState } from "./_history-error-state";

const DEFAULT_FILTER: HistoryFilter = {
  range: "30d",
  start: null,
  end: null,
  events: [],
  implementsKg: [],
  prOnly: false,
};

function hasAnyActive(f: HistoryFilter): boolean {
  return (
    f.range !== "30d" ||
    f.events.length > 0 ||
    f.implementsKg.length > 0 ||
    f.prOnly
  );
}

function filterToQueryString(f: HistoryFilter): string {
  const params = new URLSearchParams();
  params.set("range", f.range);
  if (f.range === "custom") {
    if (f.start) params.set("start", f.start);
    if (f.end) params.set("end", f.end);
  }
  if (f.events.length > 0) params.set("events", f.events.join(","));
  if (f.implementsKg.length > 0) params.set("implements", f.implementsKg.join(","));
  if (f.prOnly) params.set("prOnly", "true");
  return params.toString();
}

// Group days into weeks for rendering dividers between them.
function weekKey(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const monday = new Date(d);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(mondayIso: string): string {
  const d = new Date(`${mondayIso}T12:00:00`);
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `Week of ${month} ${d.getDate()}`;
}

export function HistoryClient() {
  const toast = useToast();
  const [filter, setFilter] = useState<HistoryFilter>(DEFAULT_FILTER);
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [totals, setTotals] = useState<{ sessions: number; throws: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sheetVariant, setSheetVariant] = useState<FilterVariant | null>(null);

  const fetchHistory = useCallback(async (f: HistoryFilter) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/throws/history?${filterToQueryString(f)}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        const msg = payload.error || `Request failed (${res.status})`;
        setErrorMsg(msg);
        toast.error(msg);
        setStatus("error");
        return;
      }
      const data = payload.data as HistoryResponse;
      setDays(data.days);
      setTotals(data.totals);
      setStatus("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMsg(msg);
      toast.error(msg);
      setStatus("error");
    }
  }, [toast]);

  useEffect(() => {
    fetchHistory(filter);
  }, [filter, fetchHistory]);

  const handleClearFilters = () => setFilter(DEFAULT_FILTER);

  // Group days by week for divider rendering
  const weekGroups: { weekStart: string; days: HistoryDay[] }[] = [];
  for (const d of days) {
    const ws = weekKey(d.date);
    const last = weekGroups[weekGroups.length - 1];
    if (last && last.weekStart === ws) {
      last.days.push(d);
    } else {
      weekGroups.push({ weekStart: ws, days: [d] });
    }
  }

  const filtersActive = hasAnyActive(filter);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div>
        <h1 className="text-display font-heading text-[var(--foreground)]">History</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Everything you&rsquo;ve thrown
        </p>
      </div>

      {/* Filter chips */}
      <HistoryFilterChips
        filter={filter}
        onOpen={(v) => setSheetVariant(v)}
        onClear={handleClearFilters}
        hasAnyActive={filtersActive}
      />

      {/* Summary line */}
      {status === "ready" && totals && (
        <div className="text-xs font-mono text-muted uppercase tracking-wider">
          {totals.sessions} sessions · {totals.throws} throws
        </div>
      )}

      {/* Body */}
      {status === "loading" && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <SkeletonLine className="w-16 h-3" />
              <SkeletonLine className="w-24 h-5" />
              <Skeleton className="w-full h-4 rounded" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <HistoryErrorState
          message={errorMsg}
          onRetry={() => fetchHistory(filter)}
        />
      )}

      {status === "ready" && days.length === 0 && !filtersActive && <HistoryEmptyState />}
      {status === "ready" && days.length === 0 && filtersActive && (
        <HistoryFiltersEmptyState onClear={handleClearFilters} />
      )}

      {status === "ready" && days.length > 0 && (
        <div className="space-y-2">
          {weekGroups.map((group, gi) => (
            <div key={group.weekStart}>
              {gi > 0 && <HistoryWeekDivider label={weekLabel(group.weekStart)} />}
              {group.days.map((day) => (
                <div key={day.date} className="mb-2">
                  <HistoryDayCard day={day} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Filter sheets — one generic component with variants */}
      <HistoryFilterSheet
        open={sheetVariant !== null}
        variant={sheetVariant ?? "range"}
        onClose={() => setSheetVariant(null)}
      >
        {sheetVariant === "range" && (
          <FilterRangeSheetBody
            value={filter.range}
            onChange={(range) => {
              setFilter((f) => ({ ...f, range }));
              setSheetVariant(null);
            }}
          />
        )}
        {sheetVariant === "event" && (
          <FilterEventSheetBody
            value={filter.events}
            onChange={(events) => {
              setFilter((f) => ({ ...f, events }));
              setSheetVariant(null);
            }}
          />
        )}
        {sheetVariant === "implement" && (
          <FilterImplementSheetBody
            days={days}
            value={filter.implementsKg}
            onChange={(implementsKg) => {
              setFilter((f) => ({ ...f, implementsKg }));
              setSheetVariant(null);
            }}
          />
        )}
        {sheetVariant === "pr" && (
          <FilterPrSheetBody
            value={filter.prOnly}
            onChange={(prOnly) => {
              setFilter((f) => ({ ...f, prOnly }));
              setSheetVariant(null);
            }}
          />
        )}
      </HistoryFilterSheet>
    </div>
  );
}

// ── Inline sheet body components ──

function FilterRangeSheetBody({
  value,
  onChange,
}: {
  value: HistoryFilter["range"];
  onChange: (v: HistoryFilter["range"]) => void;
}) {
  const options: { v: HistoryFilter["range"]; label: string }[] = [
    { v: "7d", label: "Last 7 days" },
    { v: "30d", label: "Last 30 days" },
    { v: "90d", label: "Last 90 days" },
    { v: "ytd", label: "Year to date" },
    { v: "all", label: "All time" },
  ];
  return (
    <ul className="space-y-1">
      {options.map((opt) => (
        <li key={opt.v}>
          <button
            type="button"
            onClick={() => onChange(opt.v)}
            className={`w-full text-left px-3 py-3 rounded-lg ${
              value === opt.v
                ? "bg-primary-500/15 text-primary-500"
                : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function FilterEventSheetBody({
  value,
  onChange,
}: {
  value: HistoryFilter["events"];
  onChange: (v: HistoryFilter["events"]) => void;
}) {
  const options: { v: HistoryFilter["events"][number]; label: string }[] = [
    { v: "SHOT_PUT", label: "Shot Put" },
    { v: "DISCUS", label: "Discus" },
    { v: "HAMMER", label: "Hammer" },
    { v: "JAVELIN", label: "Javelin" },
  ];
  const toggle = (ev: HistoryFilter["events"][number]) => {
    onChange(value.includes(ev) ? value.filter((e) => e !== ev) : [...value, ev]);
  };
  return (
    <ul className="space-y-1">
      {options.map((opt) => {
        const on = value.includes(opt.v);
        return (
          <li key={opt.v}>
            <button
              type="button"
              onClick={() => toggle(opt.v)}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between ${
                on
                  ? "bg-primary-500/15 text-primary-500"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]"
              }`}
            >
              <span>{opt.label}</span>
              {on && <span aria-hidden="true">✓</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FilterImplementSheetBody({
  days,
  value,
  onChange,
}: {
  days: HistoryDay[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  // Derive available implements from the currently-loaded days (contextual filter).
  const available = Array.from(
    new Set(days.flatMap((d) => d.drills.map((dr) => dr.implementKg)))
  ).sort((a, b) => b - a);

  if (available.length === 0) {
    return <p className="text-sm text-muted py-4">No implements in current range.</p>;
  }

  const toggle = (kg: number) => {
    onChange(value.includes(kg) ? value.filter((k) => k !== kg) : [...value, kg]);
  };

  return (
    <ul className="space-y-1">
      {available.map((kg) => {
        const on = value.includes(kg);
        return (
          <li key={kg}>
            <button
              type="button"
              onClick={() => toggle(kg)}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between font-mono ${
                on
                  ? "bg-primary-500/15 text-primary-500"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]"
              }`}
            >
              <span>{kg}kg</span>
              {on && <span aria-hidden="true">✓</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FilterPrSheetBody({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`w-full text-left px-3 py-3 rounded-lg ${
          !value ? "bg-primary-500/15 text-primary-500" : "hover:bg-surface-100 dark:hover:bg-surface-800"
        }`}
      >
        All throws
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`w-full text-left px-3 py-3 rounded-lg ${
          value ? "bg-primary-500/15 text-primary-500" : "hover:bg-surface-100 dark:hover:bg-surface-800"
        }`}
      >
        ★ Personal bests only
      </button>
    </div>
  );
}
```

---

## Task 11 — History page server wrapper + loading + commit

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/history/page.tsx`
- Create: `src/app/(dashboard)/athlete/throws/history/loading.tsx`

**Commit target:** `feat(throws): /athlete/throws/history page UI`

- [ ] **Step 11.1: Create the server component wrapper**

```tsx
// src/app/(dashboard)/athlete/throws/history/page.tsx
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { HistoryClient } from "./_history-client";

export const metadata = {
  title: "Throws History",
};

export default function ThrowsHistoryPage() {
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <ScrollProgressBar />
      <HistoryClient />
    </div>
  );
}
```

- [ ] **Step 11.2: Create the loading.tsx shimmer**

```tsx
// src/app/(dashboard)/athlete/throws/history/loading.tsx
import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function ThrowsHistoryLoading() {
  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-4">
      <div className="space-y-2">
        <SkeletonLine className="w-32 h-8" />
        <SkeletonLine className="w-48 h-4" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-8 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2">
            <SkeletonLine className="w-16 h-3" />
            <SkeletonLine className="w-24 h-5" />
            <Skeleton className="w-full h-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 11.3: Run typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 11.4: Run all the history-related tests**

```bash
npm test -- src/lib/throws src/app/\(dashboard\)/athlete/throws/history
```

Expected: all tests PASS.

- [ ] **Step 11.5: Manually verify the page renders end-to-end**

```bash
npm run dev
# Open http://localhost:3000/athlete/throws/history
# Log in as coach@example.com / coach123 is wrong — use athlete1@example.com / athlete123
# Verify: page renders, filter chips visible, "Log a Throw" CTA visible if no history
```

- [ ] **Step 11.6: Commit Tasks 6-11 together**

```bash
git add src/app/\(dashboard\)/athlete/throws/history/
git commit -m "$(cat <<'EOF'
feat(throws): /athlete/throws/history page UI

New mobile-first history page that replaces the missing "throws history" concept.
Shows a reverse-chronological timeline grouped by day, with filters for date
range, event, implement, and PR-only. Each day card expands in place to show
individual drill rows.

Components:
- HistoryClient — state manager with 5 page states (loading/ready/filter-empty/no-data/error)
- HistoryDayCard — collapsible day with summary stats and drill rows
- HistoryFilterChips / HistoryFilterSheet — generic bottom sheet with variant prop
- HistoryDrillRow / HistoryWeekDivider / empty/error state components
- loading.tsx shimmer skeleton

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12 — Read-only session view at `/athlete/throws/session/[id]`

**Files:**
- Create: `src/app/(dashboard)/athlete/throws/session/[id]/page.tsx`

**Commit target:** `feat(throws): /athlete/throws/session/[id] read-only session view`

- [ ] **Step 12.1: Create the server component page**

```tsx
// src/app/(dashboard)/athlete/throws/session/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { EVENTS, parseEvents } from "@/lib/throws/constants";

export const metadata = {
  title: "Throws Session",
};

export default async function ReadOnlySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const assignment = await prisma.throwsAssignment.findUnique({
    where: { id },
    include: {
      session: {
        include: {
          blocks: {
            orderBy: { position: "asc" },
          },
        },
      },
      throwLogs: {
        orderBy: { throwNumber: "asc" },
      },
    },
  });

  if (!assignment) notFound();

  const allowed = await canAccessAthlete(
    session.userId,
    session.role as "COACH" | "ATHLETE",
    assignment.athleteId
  );
  if (!allowed) notFound();

  const events = parseEvents(assignment.session.event);
  const primaryMeta = EVENTS[events[0]];

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-6">
      {/* Back link */}
      <Link
        href="/athlete/throws/history"
        className="inline-flex items-center gap-1 text-sm text-surface-700 dark:text-surface-300 hover:text-[var(--foreground)] transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to History
      </Link>

      {/* Header */}
      <div>
        <div className="flex gap-1 mb-2">
          {events.map((ev) => {
            const meta = EVENTS[ev];
            return (
              <span
                key={ev}
                className="text-xs font-bold px-2 py-0.5 rounded text-white"
                style={{ backgroundColor: meta?.color || "#666" }}
              >
                {meta?.label || ev}
              </span>
            );
          })}
        </div>
        <h1 className="text-display font-heading text-[var(--foreground)]">
          {assignment.session.name}
        </h1>
        <p className="text-sm text-muted font-mono mt-1">
          {assignment.assignedDate} · {assignment.status}
        </p>
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {assignment.session.blocks.map((block) => {
          const blockLogs = assignment.throwLogs.filter((l) => l.blockId === block.id);
          return (
            <div key={block.id} className="card p-4">
              <h2 className="text-section font-heading text-[var(--foreground)]">
                {block.blockType}
              </h2>
              {blockLogs.length === 0 ? (
                <p className="text-sm text-muted mt-2">No throws logged for this block.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {blockLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex justify-between text-sm font-mono tabular-nums text-surface-700 dark:text-surface-300"
                    >
                      <span>
                        #{log.throwNumber} · {log.implement}
                      </span>
                      <span className="text-[var(--foreground)] font-semibold">
                        {log.distance != null ? `${log.distance.toFixed(2)}m` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Coach feedback if any */}
      {assignment.feedbackNotes && (
        <div className="card p-4">
          <h2 className="text-section font-heading text-[var(--foreground)]">
            Coach Feedback
          </h2>
          <p className="text-sm text-surface-700 dark:text-surface-300 mt-2 whitespace-pre-wrap">
            {assignment.feedbackNotes}
          </p>
        </div>
      )}

      {/* Athlete self-feeling + RPE */}
      {(assignment.rpe != null || assignment.selfFeeling) && (
        <div className="card p-4">
          <h2 className="text-section font-heading text-[var(--foreground)]">How It Felt</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
            {assignment.rpe != null && (
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">RPE</dt>
                <dd className="text-lg font-mono text-[var(--foreground)]">{assignment.rpe}</dd>
              </div>
            )}
            {assignment.selfFeeling && (
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Feeling</dt>
                <dd className="text-sm text-[var(--foreground)]">{assignment.selfFeeling}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 12.2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 12.3: Manually verify with a real assignment**

```bash
npm run dev
# Log in as athlete1@example.com / athlete123
# Find an assignment id in the seed data or from the History page
# Visit http://localhost:3000/athlete/throws/session/<id>
# Verify: page renders with blocks, logs, feedback
# Verify: Back link goes to /athlete/throws/history
```

- [ ] **Step 12.4: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/session/
git commit -m "$(cat <<'EOF'
feat(throws): /athlete/throws/session/[id] read-only session view

New read-only view for past assigned throws sessions. Linked from the History
page via "View full session →" on each expanded day card. Shows session name,
event badges, blocks with their throw logs, coach feedback, and athlete
self-feeling/RPE. No edit controls — this is a historical view, not the live
player.

Separated from /athlete/throws/live/[assignmentId] because the live page
assumes IN_PROGRESS state and mutable logs; mixing the two would require too
many conditionals.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13 — Restructure athlete sidebar

**Files:**
- Modify: `src/components/ui/Sidebar.tsx` (around line 395, `ATHLETE_NAV_SECTIONS`)

**Commit target:** `refactor(athlete/nav): restructure sidebar with Throws section + 5 sub-items`

- [ ] **Step 13.1: Read the current `ATHLETE_NAV_SECTIONS` definition**

Use Read tool on `src/components/ui/Sidebar.tsx` starting at line 395, 60 lines. Note the existing imports for icons.

- [ ] **Step 13.2: Edit `ATHLETE_NAV_SECTIONS` to insert the Throws section**

Replace the existing "Throw History" item with a Throws section containing 5 sub-items. Use the same nested-children pattern the coach side uses at lines 332-361.

```tsx
// src/components/ui/Sidebar.tsx — ATHLETE_NAV_SECTIONS (around line 395)
// Replace the existing "Throw History" nav item with the block below.

{
  label: "Throws",
  href: "/athlete/throws",
  icon: <Target {...iconSize} />,
  matchPaths: ["/athlete/throws"],
  children: [
    {
      label: "Today",
      href: "/athlete/throws",
      icon: <Target {...iconSize} />,
      matchPaths: ["/athlete/throws"],
    },
    {
      label: "Log a Throw",
      href: "/athlete/throws/log",
      icon: <PlusCircle {...iconSize} />,
      matchPaths: ["/athlete/throws/log"],
    },
    {
      label: "History",
      href: "/athlete/throws/history",
      icon: <Clock {...iconSize} />,
      matchPaths: ["/athlete/throws/history", "/athlete/throws/session"],
    },
    {
      label: "Trends & PRs",
      href: "/athlete/throws/trends",
      icon: <BarChart3 {...iconSize} />,
      matchPaths: ["/athlete/throws/trends"],
    },
    {
      label: "Readiness",
      href: "/athlete/throws/readiness",
      icon: <Heart {...iconSize} />,
      matchPaths: ["/athlete/throws/readiness"],
    },
  ],
},
```

- [ ] **Step 13.3: Add any missing icon imports**

At the top of `Sidebar.tsx`, ensure these icons are imported from `lucide-react`:
```ts
import { ..., Target, PlusCircle, Clock, BarChart3, Heart } from "lucide-react";
```

Some of these may already be imported. Only add the missing ones.

- [ ] **Step 13.4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 13.5: Manual verification**

```bash
npm run dev
# Log in as athlete1@example.com
# Open the hamburger menu on mobile (or sidebar on desktop)
# Verify: "Throws" section is visible with 5 nested sub-items
# Click each sub-item in turn, verify the destination page title matches
```

- [ ] **Step 13.6: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "$(cat <<'EOF'
refactor(athlete/nav): restructure sidebar with Throws section + 5 sub-items

Replaces the single "Throw History" nav item (which pointed at /athlete/throws,
a page that wasn't actually history) with a nested "Throws" section containing
Today, Log a Throw, History, Trends & PRs, and Readiness.

This is the top-level IA change that underpins the rework — each sub-item
points at a focused single-purpose page instead of a single catchall page
doing too many things.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14 — Scope `/athlete/throws` page down to Today view

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/page.tsx`

**Commit target:** `refactor(throws): scope /athlete/throws down to Today view`

- [ ] **Step 14.1: Read the current page (lines 120-320)**

Use Read tool. Identify:
- The action chip row (around lines 199-218) — must be removed
- The `pastSessions` computation and rendering — must be removed (History page owns past)
- The `todaySessions`, `activeSessions`, `upcomingSessions` logic — keep
- The rest-day empty state — keep

- [ ] **Step 14.2: Remove the action chip row**

Replace the block at lines ~199-218 (three `<Link className="action-chip">` items pointing to /profile, /log, /analysis) with nothing. Delete the containing `<div className="flex gap-2 overflow-x-auto pb-1">` entirely.

- [ ] **Step 14.3: Remove the "past sessions" block**

Find the `pastSessions` variable and any JSX that renders it. Delete both. Verify no other code references `pastSessions` after removal.

- [ ] **Step 14.4: Update the page title**

Change the `<h1>` text from "Throws Practice" to "Today's Throws" to match the new scoped intent:

```tsx
<h1 className="text-display font-heading text-[var(--foreground)]">Today&rsquo;s Throws</h1>
<p className="text-sm text-surface-700 dark:text-surface-300">Your scheduled session for today</p>
```

- [ ] **Step 14.5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. If `pastSessions` is referenced elsewhere, remove those references too.

- [ ] **Step 14.6: Manual verification**

```bash
npm run dev
# Visit /athlete/throws
# Verify: no action chip row at the top
# Verify: no "past sessions" section
# Verify: today's assigned session or rest-day state is shown
# Verify: title reads "Today's Throws"
```

- [ ] **Step 14.7: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/page.tsx
git commit -m "$(cat <<'EOF'
refactor(throws): scope /athlete/throws down to Today view

Removes the action chip row (View PRs / Throw history / Analysis) — those
destinations now live in the sidebar under the Throws section. Removes the
past-sessions block — that content moved to /athlete/throws/history.

The page now answers a single question: "what should I do right now for my
throwing training?" It shows today's assigned session, in-progress resumable
sessions, upcoming session preview, or a rest-day state.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15 — Scope `/athlete/throws/log` down: remove trend charts and past-entries section

**Files:**
- Modify: `src/app/(dashboard)/athlete/throws/log/page.tsx`

**Commit target:** `refactor(throws/log): remove trend chart + past-entries list from /log`

- [ ] **Step 15.1: Read the current page and identify what to remove**

Use Read tool on `src/app/(dashboard)/athlete/throws/log/page.tsx`. Find:
- The `dynamic` imports for `BestMarkChart` and `VolumeChart` — remove
- Any JSX rendering `<BestMarkChart>` or `<VolumeChart>` — remove
- Any "Past entries" / "Previous throws" / "Recent history" JSX block — remove

- [ ] **Step 15.2: Remove the dynamic chart imports**

Delete both `dynamic(...)` calls for `BestMarkChart` and `VolumeChart` at the top of the file. Delete the `import dynamic from "next/dynamic";` if nothing else uses it.

- [ ] **Step 15.3: Remove the chart JSX**

Find and remove the JSX that renders `<BestMarkChart>` and `<VolumeChart>` and any wrapper cards/sections containing them.

- [ ] **Step 15.4: Remove the past-entries section**

If present, find the section that renders recent logged throws as a list and remove it. This might look like `trendSeries.map(...)` or similar.

- [ ] **Step 15.5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. Remove any now-unused types or helpers that only served the removed charts/lists.

- [ ] **Step 15.6: Manual verification**

```bash
npm run dev
# Visit /athlete/throws/log
# Verify: free-form drill row builder is still present (event picker, implement picker, drill type, throw count, best mark fields)
# Verify: no charts visible
# Verify: no "recent throws" list
# Add a new throw, save, verify toast + form reset work as before
```

- [ ] **Step 15.7: Commit**

```bash
git add src/app/\(dashboard\)/athlete/throws/log/page.tsx
git commit -m "$(cat <<'EOF'
refactor(throws/log): remove trend charts and past-entries from /log

The /athlete/throws/log page now scopes down to a single question: "I want to
log a throw that wasn't part of an assigned session." Charts and recent throws
lists have moved to /athlete/throws/trends and /athlete/throws/history
respectively.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16 — Sidebar href resolution regression guard test (TDD)

**Files:**
- Create: `src/__tests__/nav/sidebar-resolution.test.ts`

**Commit target:** `test(athlete/nav): sidebar href resolution regression guard`

- [ ] **Step 16.1: Write the regression guard test**

```ts
// src/__tests__/nav/sidebar-resolution.test.ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ATHLETE_NAV_SECTIONS, COACH_NAV_SECTIONS, type NavItem, type NavSection } from "@/components/ui/Sidebar";

const APP_ROOT = path.join(process.cwd(), "src", "app", "(dashboard)");

function flattenNav(sections: NavSection[]): NavItem[] {
  const out: NavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      out.push(item);
      if (item.children) {
        for (const child of item.children) out.push(child);
      }
    }
  }
  return out;
}

function routeToPagePath(href: string): string {
  // Strip leading slash, add page.tsx — e.g. /athlete/throws → src/app/(dashboard)/athlete/throws/page.tsx
  const clean = href.startsWith("/") ? href.slice(1) : href;
  return path.join(APP_ROOT, clean, "page.tsx");
}

describe("sidebar href resolution (regression guard)", () => {
  it("every athlete nav href resolves to an existing page.tsx", () => {
    const items = flattenNav(ATHLETE_NAV_SECTIONS);
    const missing: string[] = [];

    for (const item of items) {
      if (!item.href) continue;
      // Skip external and mailto links
      if (item.href.startsWith("http") || item.href.startsWith("mailto:")) continue;
      // Accept either page.tsx or route.tsx (rare)
      const target = routeToPagePath(item.href);
      if (!fs.existsSync(target)) {
        missing.push(`${item.label} → ${item.href} (expected at ${target})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Sidebar has ${missing.length} broken href(s):\n  ${missing.join("\n  ")}`
      );
    }
  });

  it("every coach nav href resolves to an existing page.tsx", () => {
    const items = flattenNav(COACH_NAV_SECTIONS);
    const missing: string[] = [];

    for (const item of items) {
      if (!item.href) continue;
      if (item.href.startsWith("http") || item.href.startsWith("mailto:")) continue;
      const target = routeToPagePath(item.href);
      if (!fs.existsSync(target)) {
        missing.push(`${item.label} → ${item.href} (expected at ${target})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Sidebar has ${missing.length} broken href(s):\n  ${missing.join("\n  ")}`
      );
    }
  });
});
```

- [ ] **Step 16.2: Run the test — expect PASS**

```bash
npm test -- src/__tests__/nav/sidebar-resolution.test.ts
```

Expected: both tests PASS (after all previous tasks, every href in the restructured sidebar should resolve). If they fail, something in the sidebar references a route that doesn't exist — fix before proceeding.

- [ ] **Step 16.3: Verify the test catches regressions (sanity check)**

Temporarily break a href to confirm the test catches it:

1. Edit `src/components/ui/Sidebar.tsx` — change one athlete nav href to `/athlete/does-not-exist`
2. Run: `npm test -- src/__tests__/nav/sidebar-resolution.test.ts`
3. Expected: FAIL with "Sidebar has 1 broken href(s)"
4. Revert the change
5. Run test again — expected: PASS

This step is not captured in commit history — it's a one-time sanity check.

- [ ] **Step 16.4: Check if `NavItem` and `NavSection` types are exported from Sidebar.tsx**

```bash
# Use Grep:
# pattern: "export type (NavItem|NavSection)", path: src/components/ui/Sidebar.tsx
```

If not exported, add the `export` keyword to their definitions. The test file imports them.

- [ ] **Step 16.5: Commit**

```bash
git add src/components/ui/Sidebar.tsx src/__tests__/nav/sidebar-resolution.test.ts
git commit -m "$(cat <<'EOF'
test(athlete/nav): sidebar href resolution regression guard

Permanent test that imports ATHLETE_NAV_SECTIONS and COACH_NAV_SECTIONS and
verifies every href resolves to an actual page.tsx file under src/app/.
Catches the class of bug this whole rework was created to fix — a sidebar
pointing at a route that doesn't exist or was renamed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17 — Full verification sweep

**Files:** no file changes

**Commit target:** no commit — verification only

- [ ] **Step 17.1: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 17.2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 17.3: Run lint**

```bash
npm run lint
```

Expected: 0 errors (warnings OK).

- [ ] **Step 17.4: Manual sidebar click-through on mobile viewport**

```bash
npm run dev
# Open http://localhost:3000/athlete/dashboard in Chrome
# DevTools → Device Mode → iPhone 14 Pro (or any narrow preset)
# Log in as athlete1@example.com / athlete123
# Click hamburger menu
# Verify each nav item in ATHLETE_NAV_SECTIONS:
#   ☐ Dashboard → dashboard renders
#   ☐ Training → training hub renders
#   ☐ Throws (section header — verify expanded, sub-items visible)
#     ☐ Today → today's session OR rest day
#     ☐ Log a Throw → free-form drill builder form
#     ☐ History → timeline OR empty state
#     ☐ Trends & PRs → charts (was /analysis)
#     ☐ Readiness → readiness scores (was /profile)
#   ☐ Team → team page renders
#   ☐ Team Hub → hub renders
#   ☐ Availability → availability renders
#   ☐ Wellness Check-in → wellness renders
```

- [ ] **Step 17.5: Test the redirects manually**

```bash
# With dev server still running:
curl -I http://localhost:3000/athlete/throws/analysis
# Expected: 308 Permanent Redirect, Location: /athlete/throws/trends

curl -I http://localhost:3000/athlete/throws/profile
# Expected: 308 Permanent Redirect, Location: /athlete/throws/readiness
```

- [ ] **Step 17.6: Test History page functionality**

```bash
# Still in dev:
# Visit http://localhost:3000/athlete/throws/history
# Verify:
#   ☐ Page renders (no console errors)
#   ☐ Filter chips visible at top: 30 days, Event, Implement, ★ PR
#   ☐ Summary line shows "N sessions · M throws"
#   ☐ Day cards render if seed data has throws
#   ☐ Tap a day card — it expands with drill rows
#   ☐ Tap the range chip — bottom sheet slides up with date range options
#   ☐ Close the sheet with X button or Escape
#   ☐ Change range to "All time" — page refetches
#   ☐ Toggle PR chip — shows only PR-containing days
#   ☐ Click "Clear" chip — filters reset to defaults
```

- [ ] **Step 17.7: Test the read-only session view**

```bash
# If any day card shows "View full session →" link:
# Click it — verify:
#   ☐ Navigates to /athlete/throws/session/[id]
#   ☐ Shows session name, event badges, blocks, throw logs
#   ☐ Back link returns to /athlete/throws/history
```

- [ ] **Step 17.8: Stop dev server**

```bash
# Ctrl-C the dev server
```

---

## Task 18 — Open the pull request

**Files:** no file changes

- [ ] **Step 18.1: Verify all commits are present**

```bash
git log --oneline main..HEAD
```

Expected: 7 commits in reverse order, matching the commit targets above:
```
<hash> test(athlete/nav): sidebar href resolution regression guard
<hash> refactor(throws/log): remove trend charts and past-entries from /log
<hash> refactor(throws): scope /athlete/throws down to Today view
<hash> refactor(athlete/nav): restructure sidebar with Throws section + 5 sub-items
<hash> feat(throws): /athlete/throws/session/[id] read-only session view
<hash> feat(throws): /athlete/throws/history page UI
<hash> feat(throws): /api/throws/history endpoint + aggregation helper
<hash> chore(throws): rename /analysis → /trends and /profile → /readiness
```

- [ ] **Step 18.2: Push the branch**

Ask the user whether they want to push and open a PR. If they confirm:

```bash
git push -u origin HEAD
```

- [ ] **Step 18.3: Open the PR (only if user confirms)**

```bash
gh pr create --title "Throws IA rework + new History page" --body "$(cat <<'EOF'
## Summary
- Restructure athlete sidebar — nested Throws section with 5 focused sub-pages (Today, Log, History, Trends, Readiness)
- **New History page** at `/athlete/throws/history` — reverse-chronological day timeline with filters, expandable day cards, and a read-only session drill-down
- Rename `/analysis` → `/trends` and `/profile` → `/readiness` with 301 redirects (old URLs keep working forever)
- Scope `/athlete/throws` down to just the Today view (no more action chips, no more past sessions block)
- Scope `/athlete/throws/log` down to just the logging form (charts moved to Trends, history moved to History)
- Permanent regression test that catches any future sidebar-to-page drift

## Test plan
- [ ] `npm test` — all tests pass (aggregation helper, API route, parseQuery, day card, sidebar resolution)
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Manual click-through of every sidebar item on mobile viewport
- [ ] Verify `/athlete/throws/analysis` → 308 → `/trends`
- [ ] Verify `/athlete/throws/profile` → 308 → `/readiness`
- [ ] History page: filter chips open bottom sheets, PR filter toggles, clear resets, empty states render correctly
- [ ] Read-only session view renders completed assignments with blocks and logs

Source spec: `docs/superpowers/specs/2026-04-11-throws-history-nav-rework-design.md`

Follow-up Plan B (not in this PR): athlete-side navigation audit to catch any remaining label↔destination mismatches beyond the throws family.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 18.4: Return the PR URL to the user**

---

## Self-Review Checklist

After writing this plan, the agent executing it should verify:

**Spec coverage:**
- Section 1 (page purposes) → Tasks 14 (Today scope-down), 15 (Log scope-down), 11 (History new), 1 (Trends rename), 1 (Readiness rename). Tasks 11-12 cover the new History page including read-only session view.
- Section 2 (sidebar & URL migration) → Tasks 1 (moves + redirects), 13 (sidebar restructure)
- Section 3 (History page design) → Tasks 2-11 cover all sub-components, API, aggregation, data flow, states
- Section 6 (error handling, a11y, perf) → Task 10 HistoryClient covers error state + toast surfacing; Task 8 day card uses `aria-expanded` + real `<button>`; Task 6 filter sheet has focus trap + Escape; loading states in Task 11

**Not covered by Plan A (deferred to Plan B):**
- Section 4 (audit criteria & methodology) — Plan B
- Section 5 phases 3-5 (audit sweep, fixes, verification of non-rework findings) — Plan B

**Placeholder scan:** No TBDs, TODOs, or "implement later" phrases. Every step has concrete code or an exact command. The one "TODO comment" mentioned in the spec refers to a deliberate fallback for the PR badge dependency and is called out explicitly.

**Type consistency:** `HistoryDay`, `HistoryDrill`, `HistoryFilter`, `HistoryResponse` defined in Task 2, used consistently in Tasks 3, 5, 8, 10. Aggregation helper input types (`ThrowLogInput`, `BlockLogInput`) defined in Task 3 and match the Prisma query shapes used in Task 5. `FilterVariant` type defined in Task 6 and used in Tasks 9-10.

**Ambiguity check:** The "View full session →" link target is `/athlete/throws/session/[id]`, and Task 12 creates exactly that route. The sidebar's `matchPaths` for History includes both `/history` and `/session` so the sub-item stays highlighted when drilling into a session. `/athlete/throws/log` is referenced as the CTA destination in the empty state (Task 7) and the "Log a Throw" sidebar item (Task 13) — same URL, consistent.

---

## Execution Handoff

Plan complete and ready to save. Two execution options:

1. **Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

The plan is 18 tasks across 7 commits. Subagent-driven works well for a plan this size because each task is self-contained with complete code.
