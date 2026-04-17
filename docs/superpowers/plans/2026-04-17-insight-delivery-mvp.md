# Insight Delivery MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the pages + mutation endpoints + notifications that surface sub-project B's `AthleteInsight` rows to coaches and athletes, with role-based default visibility (coach sees evidence, athlete doesn't) and a conservative notification rule (first-time slot only).

**Architecture:** No schema changes. Extend `persist.ts` with a prior-slot lookup so notifications fire only for NEW `(category, metric)` combos. Add a role-aware `InsightCard` component used by both a new athlete-facing route and an inline section on the existing coach athlete detail page. Two thin PATCH endpoints for read/dismiss state. Notification routing reuses sub-project A's pattern (`createNotification` with role-appropriate `href` metadata).

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Prisma, Zod, vitest, React Testing Library, existing `createNotification` + `canAccessAthlete` + `{ success, data | error }` envelope, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-17-insight-delivery-mvp-design.md`

**Pre-verified (so plan tasks don't re-derive):**

- Coach athlete detail at `src/app/(dashboard)/coach/athletes/[id]/page.tsx` uses scroll-anchor sections via `_section-nav.tsx` — no sub-routes. C-MVP coach integration = adding a new `<section id="insights">` to that page, NOT a new route.
- `AthleteProfile.notificationPreferences` JSON exists but there's no parallel `isAthleteNotificationEnabled` helper. MVP keeps "athletes always receive `INSIGHT_NEW`" per sub-project B's existing notify pattern. Flag C-CONFIG for athlete-side opt-outs.
- `CoachProfile.notificationPreferences` IS checked via `isCoachNotificationEnabled` in `src/lib/notifications/coach-preferences.ts`. Coach `INSIGHT_NEW` firing respects their prefs automatically (missing keys default TRUE).
- Sub-project B's `persist.ts` currently just calls `createMany`; the prior-slot lookup + notify call is additive.

---

## File Plan

### New files

| Path                                                                  | Responsibility                                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/insights/notify.ts`                                          | `notifyInsightsNew(athleteId, newInsights)` helper — writes to `Notification` table for athlete + linked coach |
| `src/lib/insights/serialize.ts`                                       | `toWire(insight: AthleteInsight): AthleteInsightWire` — converts `Date` fields to ISO strings                  |
| `src/lib/insights/__tests__/notify.test.ts`                           | Mocked-prisma tests for `notifyInsightsNew`                                                                    |
| `src/lib/insights/__tests__/persist.test.ts`                          | New: tests the prior-slot lookup + notify integration                                                          |
| `src/app/api/insights/[id]/read/route.ts`                             | `PATCH` — sets `readByCoachAt` or `readByAthleteAt`                                                            |
| `src/app/api/insights/[id]/read/__tests__/read.test.ts`               | Vitest tests                                                                                                   |
| `src/app/api/insights/[id]/dismiss/route.ts`                          | `PATCH` — sets/clears `dismissedAt`                                                                            |
| `src/app/api/insights/[id]/dismiss/__tests__/dismiss.test.ts`         | Vitest tests                                                                                                   |
| `src/components/insights/InsightCard.tsx`                             | Role-aware card: band pill, title, body, detail, dismiss, evidence (coach-only)                                |
| `src/components/insights/InsightList.tsx`                             | Grouped-by-category list + empty state                                                                         |
| `src/components/insights/InsightEvidenceDrawer.tsx`                   | Coach-only modal showing raw coefficient + evidence JSON                                                       |
| `src/components/insights/InsightEmptyState.tsx`                       | Audience-aware empty copy                                                                                      |
| `src/components/insights/__tests__/InsightCard.test.tsx`              | RTL tests                                                                                                      |
| `src/components/insights/__tests__/InsightList.test.tsx`              | RTL tests                                                                                                      |
| `src/components/insights/__tests__/InsightEvidenceDrawer.test.tsx`    | RTL tests                                                                                                      |
| `src/app/(dashboard)/athlete/insights/page.tsx`                       | Server component — fetches latest-per-slot + passes to client                                                  |
| `src/app/(dashboard)/athlete/insights/_insights-client.tsx`           | Client component — renders `<InsightList role="ATHLETE">` + recompute button + show-dismissed toggle           |
| `src/app/(dashboard)/coach/athletes/[id]/_coach-insights-section.tsx` | Client component — renders `<InsightList role="COACH">` inline on the athlete detail page                      |

### Modified files

| Path                                                       | What changes                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/notifications.ts`                                 | Append `"INSIGHT_NEW"` to `NotificationType` union                                   |
| `src/lib/insights/types.ts`                                | Append `AthleteInsightWire` type                                                     |
| `src/lib/insights/persist.ts`                              | Prior-slot lookup via `findMany`; call `notifyInsightsNew` for new-slot items        |
| `src/lib/api-schemas.ts`                                   | Extend `InsightsListQuerySchema` with `includeDismissed`; add `InsightDismissSchema` |
| `src/app/api/insights/route.ts`                            | Filter `WHERE dismissedAt IS NULL` when `!includeDismissed` in both query branches   |
| `src/app/(dashboard)/coach/athletes/[id]/page.tsx`         | Add `<section id="insights">` rendering the new coach insights section component     |
| `src/app/(dashboard)/coach/athletes/[id]/_section-nav.tsx` | Append `{ id: "insights", label: "Insights" }` to `SECTIONS` array                   |
| `src/components/ui/Sidebar.tsx`                            | Add athlete "Insights" entry with `Sparkles` icon                                    |

---

## Task 1: Add `INSIGHT_NEW` to `NotificationType` union

**Files:**

- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Open the union and append the new type**

Find the `NotificationType` union (near line 16 per the codebase). Add `| "INSIGHT_NEW"` at the end:

```ts
export type NotificationType =
  | "WORKOUT_ASSIGNED"
  | "WORKOUT_COMPLETED"
  | "WORKOUT_SKIPPED"
  | "PR_ALERT"
  | "LOW_READINESS"
  | "QUESTIONNAIRE_ASSIGNED"
  | "QUESTIONNAIRE_COMPLETE"
  | "STREAK_BROKEN"
  | "ATHLETE_JOINED"
  | "PROGRAM_CHECKPOINT"
  | "COMPLEX_ROTATED"
  | "COMMENT_ADDED"
  | "VIDEO_SHARED"
  | "COMPETITION_REMINDER"
  | "INVITATION_EXPIRED"
  | "PROGRAMMING_REQUESTED"
  | "COMPETITION_PR"
  | "COMPETITION_LOGGED"
  | "INSIGHT_NEW";
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat(notifications): INSIGHT_NEW type for insight delivery"
```

---

## Task 2: Append `AthleteInsightWire` type

**Files:**

- Modify: `src/lib/insights/types.ts`

- [ ] **Step 1: Read the existing types file**

```bash
cat "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp/src/lib/insights/types.ts"
```

Confirm it has `StructuredInsight`, `Analyzer`, `RenderedInsight`, `ConfidenceBand`, `InsightCategory`, `InsightEvent`.

- [ ] **Step 2: Append the wire type**

At the end of the file:

```ts
/**
 * Client-bound shape of an AthleteInsight row — Dates serialized to ISO strings
 * so the wire/JSON boundary is explicit. Use `toWire()` from serialize.ts
 * whenever passing Prisma rows to a client component.
 */
export type AthleteInsightWire = {
  id: string;
  athleteId: string;
  category: InsightCategory;
  metric: string;
  event: InsightEvent | null;
  title: string;
  body: string;
  detail: string | null;
  confidenceBand: ConfidenceBand;
  dataPoints: number;
  coefficient: number | null;
  effectSize: number | null;
  effectUnit: string | null;
  evidence: unknown;
  readByCoachAt: string | null;
  readByAthleteAt: string | null;
  dismissedAt: string | null;
  triggerKind: "MEET_COMPLETE" | "ON_DEMAND" | "CRON";
  triggerMeetId: string | null;
  computedAt: string;
};
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/insights/types.ts
git commit -m "feat(insights): AthleteInsightWire type for client boundaries"
```

---

## Task 3: Build the `toWire` serialize helper

**Files:**

- Create: `src/lib/insights/serialize.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/insights/serialize.ts
import type { AthleteInsight } from "@prisma/client";
import type { AthleteInsightWire } from "./types";

/**
 * Convert a Prisma AthleteInsight row to its client-bound wire shape.
 * All `Date` fields become ISO strings; everything else is passed through.
 */
export function toWire(insight: AthleteInsight): AthleteInsightWire {
  return {
    id: insight.id,
    athleteId: insight.athleteId,
    category: insight.category,
    metric: insight.metric,
    event: insight.event,
    title: insight.title,
    body: insight.body,
    detail: insight.detail,
    confidenceBand: insight.confidenceBand,
    dataPoints: insight.dataPoints,
    coefficient: insight.coefficient,
    effectSize: insight.effectSize,
    effectUnit: insight.effectUnit,
    evidence: insight.evidence,
    readByCoachAt: insight.readByCoachAt?.toISOString() ?? null,
    readByAthleteAt: insight.readByAthleteAt?.toISOString() ?? null,
    dismissedAt: insight.dismissedAt?.toISOString() ?? null,
    triggerKind: insight.triggerKind,
    triggerMeetId: insight.triggerMeetId,
    computedAt: insight.computedAt.toISOString(),
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/insights/serialize.ts
git commit -m "feat(insights): toWire serializer for client boundaries"
```

---

## Task 4: Build the `notifyInsightsNew` helper

**Files:**

- Create: `src/lib/insights/notify.ts`
- Create: `src/lib/insights/__tests__/notify.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/insights/__tests__/notify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createNotification: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mocks.findUnique(...a) },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: (...a: unknown[]) => mocks.createNotification(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { notifyInsightsNew } from "../notify";

describe("notifyInsightsNew", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires one notification each for athlete and linked coach on a single new insight", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: false,
      user: { email: "a@test.com" },
    });

    await notifyInsightsNew("a1", [
      { category: "TRAINING_PATTERN", title: "Best shot put follow 8kg weeks", body: "..." },
    ]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(2);

    const athleteCall = mocks.createNotification.mock.calls.find(
      (c) => c[0].athleteProfileId === "a1"
    );
    expect(athleteCall?.[0]).toMatchObject({
      type: "INSIGHT_NEW",
      title: "New insight",
      body: "Best shot put follow 8kg weeks",
      athleteProfileId: "a1",
      metadata: expect.objectContaining({ href: "/athlete/insights", insightCount: 1 }),
    });

    const coachCall = mocks.createNotification.mock.calls.find((c) => c[0].coachId === "c1");
    expect(coachCall?.[0]).toMatchObject({
      type: "INSIGHT_NEW",
      title: "New insight · a@test.com",
      coachId: "c1",
      metadata: expect.objectContaining({ href: "/coach/athletes/a1/insights", insightCount: 1 }),
    });
  });

  it("suppresses coach notification when athlete is self-coached", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: true,
      user: { email: "a@test.com" },
    });

    await notifyInsightsNew("a1", [{ category: "TRAINING_PATTERN", title: "T1", body: "b" }]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification.mock.calls[0][0].athleteProfileId).toBe("a1");
  });

  it("renders count-aware title and body for multi-insight batches", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: false,
      user: { email: "a@test.com" },
    });

    await notifyInsightsNew("a1", [
      { category: "TRAINING_PATTERN", title: "First title", body: "b1" },
      { category: "LIFT_THROW", title: "Second title", body: "b2" },
      { category: "READINESS_COMPETITION", title: "Third title", body: "b3" },
    ]);

    const athleteCall = mocks.createNotification.mock.calls.find(
      (c) => c[0].athleteProfileId === "a1"
    );
    expect(athleteCall?.[0].title).toBe("3 new insights");
    expect(athleteCall?.[0].body).toBe("Including: First title");
    expect(athleteCall?.[0].metadata).toMatchObject({
      insightCount: 3,
      categories: ["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"],
    });
  });

  it("swallows errors from createNotification (never throws)", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: false,
      user: { email: "a@test.com" },
    });
    mocks.createNotification.mockRejectedValueOnce(new Error("db down"));

    await expect(
      notifyInsightsNew("a1", [{ category: "TRAINING_PATTERN", title: "t", body: "b" }])
    ).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("returns silently if the athlete profile doesn't exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await notifyInsightsNew("a1", [{ category: "TRAINING_PATTERN", title: "t", body: "b" }]);

    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npm test -- src/lib/insights/__tests__/notify.test.ts
```

Expected: FAIL — `Cannot find module '../notify'`.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/insights/notify.ts
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import type { InsightCategory } from "./types";

type NewInsightInput = {
  category: InsightCategory;
  title: string;
  body: string;
};

/**
 * Fire `INSIGHT_NEW` notifications for first-time-slot insights.
 * One notification per recipient per batch (not per-insight). Never throws —
 * all errors are logged and swallowed so the caller's persist doesn't fail.
 */
export async function notifyInsightsNew(
  athleteId: string,
  newInsights: NewInsightInput[]
): Promise<void> {
  try {
    if (newInsights.length === 0) return;

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        coachId: true,
        isSelfCoached: true,
        user: { select: { email: true } },
      },
    });
    if (!athlete) return;

    const title = newInsights.length === 1 ? "New insight" : `${newInsights.length} new insights`;
    const body =
      newInsights.length === 1 ? newInsights[0].title : `Including: ${newInsights[0].title}`;
    const categories = newInsights.map((i) => i.category);

    // Always notify the athlete
    await createNotification({
      type: "INSIGHT_NEW",
      title,
      body,
      athleteProfileId: athlete.id,
      metadata: {
        insightCount: newInsights.length,
        categories,
        href: "/athlete/insights",
      },
    });

    // Notify coach unless athlete is self-coached
    if (!athlete.isSelfCoached && athlete.coachId) {
      await createNotification({
        type: "INSIGHT_NEW",
        title: `${title} · ${athlete.user.email}`,
        body,
        coachId: athlete.coachId,
        metadata: {
          insightCount: newInsights.length,
          categories,
          href: `/coach/athletes/${athlete.id}/insights`,
        },
      });
    }
  } catch (err) {
    logger.error("notifyInsightsNew failed", { context: "insights/notify", error: err });
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/__tests__/notify.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/notify.ts src/lib/insights/__tests__/notify.test.ts
git commit -m "feat(insights): notifyInsightsNew helper for first-time-slot notifications"
```

---

## Task 5: Extend `persist.ts` with prior-slot lookup + notify

**Files:**

- Modify: `src/lib/insights/persist.ts`
- Create: `src/lib/insights/__tests__/persist.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/insights/__tests__/persist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  notifyInsightsNew: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteInsight: {
      findMany: (...a: unknown[]) => mocks.findMany(...a),
      createMany: (...a: unknown[]) => mocks.createMany(...a),
    },
  },
}));

vi.mock("../notify", () => ({
  notifyInsightsNew: (...a: unknown[]) => mocks.notifyInsightsNew(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { persistInsights } from "../persist";

function row(
  overrides: Partial<Parameters<typeof persistInsights>[1][number]> = {}
): Parameters<typeof persistInsights>[1][number] {
  return {
    category: "TRAINING_PATTERN",
    metric: "m1",
    event: null,
    title: "T",
    body: "B",
    detail: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    renderInputs: {},
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: "m1",
    ...overrides,
  };
}

describe("persistInsights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits on empty input (no queries, no notification)", async () => {
    const count = await persistInsights("a1", []);
    expect(count).toBe(0);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.notifyInsightsNew).not.toHaveBeenCalled();
  });

  it("fires notification for every item when no prior slots exist", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.createMany.mockResolvedValue({ count: 2 });

    await persistInsights("a1", [
      row({ metric: "m1", category: "TRAINING_PATTERN" }),
      row({ metric: "m2", category: "LIFT_THROW" }),
    ]);

    expect(mocks.notifyInsightsNew).toHaveBeenCalledTimes(1);
    const args = mocks.notifyInsightsNew.mock.calls[0];
    expect(args[0]).toBe("a1");
    expect(args[1]).toHaveLength(2);
  });

  it("skips notification when every slot already exists", async () => {
    mocks.findMany.mockResolvedValue([
      { category: "TRAINING_PATTERN", metric: "m1" },
      { category: "LIFT_THROW", metric: "m2" },
    ]);
    mocks.createMany.mockResolvedValue({ count: 2 });

    await persistInsights("a1", [
      row({ metric: "m1", category: "TRAINING_PATTERN" }),
      row({ metric: "m2", category: "LIFT_THROW" }),
    ]);

    expect(mocks.notifyInsightsNew).not.toHaveBeenCalled();
  });

  it("filters notification to only new-slot items in a mixed batch", async () => {
    mocks.findMany.mockResolvedValue([{ category: "TRAINING_PATTERN", metric: "m1" }]);
    mocks.createMany.mockResolvedValue({ count: 2 });

    await persistInsights("a1", [
      row({ metric: "m1", category: "TRAINING_PATTERN" }),
      row({ metric: "m2", category: "LIFT_THROW" }),
    ]);

    expect(mocks.notifyInsightsNew).toHaveBeenCalledTimes(1);
    const args = mocks.notifyInsightsNew.mock.calls[0];
    expect(args[1]).toHaveLength(1);
    expect(args[1][0].metric).toBe("m2");
  });

  it("returns createMany count even when notifyInsightsNew rejects", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.notifyInsightsNew.mockRejectedValueOnce(new Error("boom"));

    const count = await persistInsights("a1", [row()]);
    // Flush any pending microtasks
    await Promise.resolve();

    expect(count).toBe(1);
    // The catch attached in persist.ts should log:
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npm test -- src/lib/insights/__tests__/persist.test.ts
```

Expected: FAIL — `persistInsights` doesn't consult `findMany` or call `notifyInsightsNew` in its current shape.

- [ ] **Step 3: Read the current `persist.ts`**

```bash
cat src/lib/insights/persist.ts
```

Confirm the current shape (just `createMany` with no prior-slot logic).

- [ ] **Step 4: Replace `persist.ts` with the extended version**

```ts
// src/lib/insights/persist.ts
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyInsightsNew } from "./notify";
import type { RenderedInsight } from "./types";

type PersistItem = RenderedInsight & {
  triggerKind: "MEET_COMPLETE" | "ON_DEMAND" | "CRON";
  triggerMeetId: string | null;
};

export async function persistInsights(athleteId: string, items: PersistItem[]): Promise<number> {
  if (items.length === 0) return 0;

  // Look up which (category, metric) slots this athlete already has.
  // Used to decide which inserts are brand-new and deserve a notification.
  const priorSlots = await prisma.athleteInsight.findMany({
    where: { athleteId, metric: { in: items.map((i) => i.metric) } },
    select: { category: true, metric: true },
  });
  const seenSet = new Set(priorSlots.map((p) => `${p.category}:${p.metric}`));

  const rows = items.map((i) => ({
    athleteId,
    category: i.category,
    metric: i.metric,
    event: i.event ?? null,
    title: i.title,
    body: i.body,
    detail: i.detail ?? null,
    confidenceBand: i.confidenceBand,
    dataPoints: i.dataPoints,
    coefficient: i.coefficient,
    effectSize: i.effectSize,
    effectUnit: i.effectUnit,
    evidence: i.evidence as Prisma.InputJsonValue,
    triggerKind: i.triggerKind,
    triggerMeetId: i.triggerMeetId,
  }));

  const result = await prisma.athleteInsight.createMany({ data: rows });

  // Fire-and-forget: only for NEW slots. Failure never breaks persist.
  const newSlotItems = items.filter((i) => !seenSet.has(`${i.category}:${i.metric}`));
  if (newSlotItems.length > 0) {
    void notifyInsightsNew(
      athleteId,
      newSlotItems.map((i) => ({ category: i.category, title: i.title, body: i.body }))
    ).catch((err) => {
      logger.error("insight notification dispatch failed", { athleteId, error: err });
    });
  }

  return result.count;
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
npm test -- src/lib/insights/__tests__/persist.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Run the existing runInsights test file to make sure nothing regressed**

```bash
npm test -- src/lib/insights/__tests__/runInsights.test.ts
```

Expected: all prior tests still pass (persist.ts is called by runInsights but only test-mocks touch it).

- [ ] **Step 7: Commit**

```bash
git add src/lib/insights/persist.ts src/lib/insights/__tests__/persist.test.ts
git commit -m "feat(insights): persist prior-slot lookup + first-time notification dispatch"
```

---

## Task 6: Extend `InsightsListQuerySchema` + add `InsightDismissSchema`

**Files:**

- Modify: `src/lib/api-schemas.ts`

- [ ] **Step 1: Locate the existing insights schemas**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
grep -n "InsightsListQuerySchema\|InsightComputeSchema" src/lib/api-schemas.ts
```

- [ ] **Step 2: Extend `InsightsListQuerySchema` and append `InsightDismissSchema`**

Replace the `InsightsListQuerySchema` block with:

```ts
export const InsightsListQuerySchema = z.object({
  athleteId: z.string().min(1),
  mode: z.enum(["latest", "all"]).optional().default("latest"),
  category: z.enum(["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  includeDismissed: z.coerce.boolean().optional().default(false),
});

export const InsightDismissSchema = z.object({
  undismiss: z.boolean().optional(),
});
```

Keep `InsightComputeSchema` unchanged.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-schemas.ts
git commit -m "feat(schemas): insight list includeDismissed + InsightDismissSchema"
```

---

## Task 7: Extend `GET /api/insights` with `includeDismissed` filter

**Files:**

- Modify: `src/app/api/insights/route.ts`
- Modify: `src/app/api/insights/__tests__/insights.test.ts`

- [ ] **Step 1: Add failing tests for the new filter**

Append to the existing test file:

```ts
describe("GET /api/insights (includeDismissed)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters out dismissed rows by default in mode=all", async () => {
    mocks.findMany.mockResolvedValue([{ id: "i1" }]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=all");
    await GET(req);

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ athleteId: "a1", dismissedAt: null });
  });

  it("returns all rows when includeDismissed=true in mode=all", async () => {
    mocks.findMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);
    const req = new NextRequest(
      "http://t/api/insights?athleteId=a1&mode=all&includeDismissed=true"
    );
    await GET(req);

    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ athleteId: "a1" });
    expect(args.where.dismissedAt).toBeUndefined();
  });

  it("includes dismissed filter in raw SQL for mode=latest by default", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const req = new NextRequest("http://t/api/insights?athleteId=a1&mode=latest");
    await GET(req);

    // The Prisma.sql template object has a `.strings` array of the SQL fragments.
    // We verify the dismiss filter is present.
    const sqlArg = mocks.queryRaw.mock.calls[0][0];
    const combined = Array.isArray(sqlArg.strings) ? sqlArg.strings.join("") : String(sqlArg);
    expect(combined).toContain(`dismissedAt`);
  });

  it("omits dismiss filter from raw SQL when includeDismissed=true", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const req = new NextRequest(
      "http://t/api/insights?athleteId=a1&mode=latest&includeDismissed=true"
    );
    await GET(req);

    const sqlArg = mocks.queryRaw.mock.calls[0][0];
    const combined = Array.isArray(sqlArg.strings) ? sqlArg.strings.join("") : String(sqlArg);
    expect(combined).not.toContain(`dismissedAt`);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- src/app/api/insights/__tests__/insights.test.ts
```

Expected: new tests FAIL.

- [ ] **Step 3: Update the GET handler**

Replace `src/app/api/insights/route.ts` entirely with:

```ts
// src/app/api/insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { InsightsListQuerySchema } from "@/lib/api-schemas";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = InsightsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }
    const { athleteId, mode, category, limit, includeDismissed } = parsed.data;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let insights: unknown[];

    if (mode === "latest") {
      const categoryFilter = category
        ? Prisma.sql`AND "category"::text = ${category}`
        : Prisma.empty;
      const dismissFilter = includeDismissed ? Prisma.empty : Prisma.sql`AND "dismissedAt" IS NULL`;

      insights = await prisma.$queryRaw<unknown[]>(Prisma.sql`
        SELECT DISTINCT ON ("athleteId", "category", "metric") *
        FROM "AthleteInsight"
        WHERE "athleteId" = ${athleteId}
          ${categoryFilter}
          ${dismissFilter}
        ORDER BY "athleteId", "category", "metric", "computedAt" DESC
        LIMIT ${limit}
      `);
    } else {
      insights = await prisma.athleteInsight.findMany({
        where: {
          athleteId,
          ...(category ? { category } : {}),
          ...(includeDismissed ? {} : { dismissedAt: null }),
        },
        orderBy: { computedAt: "desc" },
        take: limit,
      });
    }

    return NextResponse.json({
      success: true,
      data: { insights, total: insights.length },
    });
  } catch (error) {
    logger.error("Get insights error", { context: "insights/route", error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run all insights tests**

```bash
npm test -- src/app/api/insights/__tests__/insights.test.ts
```

Expected: all prior tests + 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/insights/route.ts src/app/api/insights/__tests__/insights.test.ts
git commit -m "feat(api): GET /api/insights filters dismissed by default"
```

---

## Task 8: `PATCH /api/insights/[id]/read`

**Files:**

- Create: `src/app/api/insights/[id]/read/route.ts`
- Create: `src/app/api/insights/[id]/read/__tests__/read.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/insights/[id]/read/__tests__/read.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  canAccessAthlete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteInsight: {
      findUnique: (...a: unknown[]) => mocks.findUnique(...a),
      update: (...a: unknown[]) => mocks.update(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: (...a: unknown[]) => mocks.canAccessAthlete(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { PATCH } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/insights/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccessAthlete.mockResolvedValue(true);
  });

  it("coach sets readByCoachAt", async () => {
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: null,
      readByAthleteAt: null,
    });
    mocks.update.mockResolvedValue({});

    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);

    const call = mocks.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "i1" });
    expect(call.data.readByCoachAt).toBeInstanceOf(Date);
    expect(call.data.readByAthleteAt).toBeUndefined();
  });

  it("athlete sets readByAthleteAt", async () => {
    // Re-mock getCurrentUser for this test
    const auth = await import("@/lib/auth");
    vi.mocked(auth.getCurrentUser).mockResolvedValueOnce({
      userId: "u2",
      email: "a@test.com",
      role: "ATHLETE",
    } as never);

    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: null,
      readByAthleteAt: null,
    });
    mocks.update.mockResolvedValue({});

    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);
    const call = mocks.update.mock.calls[0][0];
    expect(call.data.readByAthleteAt).toBeInstanceOf(Date);
    expect(call.data.readByCoachAt).toBeUndefined();
  });

  it("is idempotent — preserves existing readByCoachAt timestamp", async () => {
    const priorDate = new Date("2026-04-01T00:00:00Z");
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: priorDate,
      readByAthleteAt: null,
    });
    mocks.update.mockResolvedValue({});

    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    await PATCH(req, ctx("i1"));

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.readByCoachAt).toEqual(priorDate);
  });

  it("404 when insight not found", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("403 when canAccessAthlete returns false", async () => {
    mocks.findUnique.mockResolvedValue({
      athleteId: "a1",
      readByCoachAt: null,
      readByAthleteAt: null,
    });
    mocks.canAccessAthlete.mockResolvedValueOnce(false);
    const req = new NextRequest("http://t/api/insights/i1/read", { method: "PATCH" });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npm test -- "src/app/api/insights/\[id\]/read/__tests__/read.test.ts"
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/app/api/insights/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const insight = await prisma.athleteInsight.findUnique({
      where: { id },
      select: { athleteId: true, readByCoachAt: true, readByAthleteAt: true },
    });
    if (!insight) {
      return NextResponse.json({ success: false, error: "Insight not found" }, { status: 404 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        insight.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const data =
      currentUser.role === "COACH"
        ? { readByCoachAt: insight.readByCoachAt ?? new Date() }
        : { readByAthleteAt: insight.readByAthleteAt ?? new Date() };

    await prisma.athleteInsight.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    logger.error("Mark insight read error", { context: "insights/read", error });
    return NextResponse.json(
      { success: false, error: "Failed to mark insight read" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- "src/app/api/insights/\[id\]/read/__tests__/read.test.ts"
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/insights/\[id\]/read"
git commit -m "feat(api): PATCH /api/insights/[id]/read — idempotent role-aware mark-read"
```

---

## Task 9: `PATCH /api/insights/[id]/dismiss`

**Files:**

- Create: `src/app/api/insights/[id]/dismiss/route.ts`
- Create: `src/app/api/insights/[id]/dismiss/__tests__/dismiss.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/app/api/insights/[id]/dismiss/__tests__/dismiss.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  canAccessAthlete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteInsight: {
      findUnique: (...a: unknown[]) => mocks.findUnique(...a),
      update: (...a: unknown[]) => mocks.update(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: (...a: unknown[]) => mocks.canAccessAthlete(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { PATCH } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/insights/[id]/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccessAthlete.mockResolvedValue(true);
  });

  it("empty body sets dismissedAt to a new Date", async () => {
    mocks.findUnique.mockResolvedValue({ athleteId: "a1" });
    mocks.update.mockResolvedValue({ dismissedAt: new Date() });

    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.dismissedAt).toBeInstanceOf(Date);
  });

  it("undismiss: true clears dismissedAt to null", async () => {
    mocks.findUnique.mockResolvedValue({ athleteId: "a1" });
    mocks.update.mockResolvedValue({ dismissedAt: null });

    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({ undismiss: true }),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.dismissedAt).toBeNull();
  });

  it("404 when insight not found", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("403 when canAccessAthlete returns false", async () => {
    mocks.findUnique.mockResolvedValue({ athleteId: "a1" });
    mocks.canAccessAthlete.mockResolvedValueOnce(false);

    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- "src/app/api/insights/\[id\]/dismiss/__tests__/dismiss.test.ts"
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/app/api/insights/[id]/dismiss/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, InsightDismissSchema } from "@/lib/api-schemas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const insight = await prisma.athleteInsight.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!insight) {
      return NextResponse.json({ success: false, error: "Insight not found" }, { status: 404 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        insight.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, InsightDismissSchema);
    if (parsed instanceof NextResponse) return parsed;

    const dismissedAt = parsed.undismiss ? null : new Date();
    const updated = await prisma.athleteInsight.update({
      where: { id },
      data: { dismissedAt },
      select: { id: true, dismissedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        dismissedAt: updated.dismissedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logger.error("Dismiss insight error", { context: "insights/dismiss", error });
    return NextResponse.json(
      { success: false, error: "Failed to update dismiss state" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- "src/app/api/insights/\[id\]/dismiss/__tests__/dismiss.test.ts"
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/insights/\[id\]/dismiss"
git commit -m "feat(api): PATCH /api/insights/[id]/dismiss with undismiss support"
```

---

## Task 10: `InsightEmptyState` component

**Files:**

- Create: `src/components/insights/InsightEmptyState.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/insights/InsightEmptyState.tsx
import Link from "next/link";

type Props = {
  role: "COACH" | "ATHLETE";
  athleteName?: string;
};

export function InsightEmptyState({ role, athleteName }: Props) {
  if (role === "ATHLETE") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h2 className="font-heading text-xl">No insights yet</h2>
        <p className="mt-3 text-muted">
          Your insights appear here once there's enough data to find patterns — typically after a
          few weeks of logged sessions and a couple of meets.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/athlete/log-session" className="text-primary-500 hover:underline">
            Log a practice session →
          </Link>
          <Link href="/athlete/competitions" className="text-primary-500 hover:underline">
            Log a competition →
          </Link>
        </div>
      </div>
    );
  }

  const name = athleteName ?? "this athlete";
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h2 className="font-heading text-xl">No insights yet for {name}</h2>
      <p className="mt-3 text-muted">
        Insights require minimum data: 5 weeks of practice for training patterns, 6 paired training
        windows for lift-throw correlations, 4 competitions for readiness-competition correlations.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/InsightEmptyState.tsx
git commit -m "feat(insights): InsightEmptyState with audience-aware copy"
```

---

## Task 11: `InsightEvidenceDrawer` component

**Files:**

- Create: `src/components/insights/InsightEvidenceDrawer.tsx`
- Create: `src/components/insights/__tests__/InsightEvidenceDrawer.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/insights/__tests__/InsightEvidenceDrawer.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InsightEvidenceDrawer } from "../InsightEvidenceDrawer";
import type { AthleteInsightWire } from "@/lib/insights/types";

function fixture(overrides: Partial<AthleteInsightWire> = {}): AthleteInsightWire {
  return {
    id: "i1",
    athleteId: "a1",
    category: "LIFT_THROW",
    metric: "back_squat_1rm.hammer",
    event: "HAMMER",
    title: "Back Squat 1RM tracks with hammer distance",
    body: "body",
    detail: "detail",
    confidenceBand: "MEDIUM",
    dataPoints: 11,
    coefficient: 0.72,
    effectSize: 0.04,
    effectUnit: "meters per kg",
    evidence: { pairs: [{ windowStart: "2026-01-01", repMaxKg: 150, bestMarkM: 68 }] },
    readByCoachAt: null,
    readByAthleteAt: null,
    dismissedAt: null,
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: "m1",
    computedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("InsightEvidenceDrawer", () => {
  it("renders coefficient, effectSize, dataPoints, confidence band", () => {
    render(<InsightEvidenceDrawer insight={fixture()} onClose={vi.fn()} />);
    expect(screen.getByText(/0\.72/)).toBeInTheDocument();
    expect(screen.getByText(/0\.04/)).toBeInTheDocument();
    expect(screen.getByText(/11/)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
    expect(screen.getByText(/meters per kg/i)).toBeInTheDocument();
  });

  it("renders pretty-printed evidence JSON", () => {
    render(<InsightEvidenceDrawer insight={fixture()} onClose={vi.fn()} />);
    const pre = screen.getByTestId("evidence-json");
    expect(pre.textContent).toContain("repMaxKg");
    expect(pre.textContent).toContain("150");
  });

  it("onClose fires on close button click", () => {
    const onClose = vi.fn();
    render(<InsightEvidenceDrawer insight={fixture()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the insight title in the header", () => {
    render(<InsightEvidenceDrawer insight={fixture()} onClose={vi.fn()} />);
    expect(screen.getByText(/Back Squat 1RM tracks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- src/components/insights/__tests__/InsightEvidenceDrawer.test.tsx
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create the component**

```tsx
// src/components/insights/InsightEvidenceDrawer.tsx
"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insight: AthleteInsightWire;
  onClose: () => void;
};

export function InsightEvidenceDrawer({ insight, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const coefficientLabel = insight.category === "LIFT_THROW" ? "Pearson r" : "Pearson r";
  const evidenceJson = JSON.stringify(insight.evidence, null, 2);

  return (
    <>
      {/* Backdrop scrim */}
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      {/* Drawer panel — opaque per project overlay rule */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-evidence-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[var(--surface-overlay)] p-6 shadow-2xl sm:inset-x-auto sm:right-6 sm:top-20 sm:bottom-auto sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <h2 id="insight-evidence-title" className="font-heading text-lg">
            Evidence for {insight.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">{coefficientLabel}</dt>
            <dd className="font-mono tabular-nums">{insight.coefficient?.toFixed(2) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Effect size</dt>
            <dd className="font-mono tabular-nums">
              {insight.effectSize != null ? insight.effectSize.toFixed(4) : "—"}
              {insight.effectUnit ? ` ${insight.effectUnit}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Data points</dt>
            <dd className="font-mono tabular-nums">{insight.dataPoints}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Confidence band</dt>
            <dd>{insight.confidenceBand}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Trigger</dt>
            <dd>{insight.triggerKind}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Computed at</dt>
            <dd className="font-mono tabular-nums text-xs">
              {new Date(insight.computedAt).toLocaleString()}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted">Evidence data</div>
          <pre
            data-testid="evidence-json"
            className="mt-2 max-h-80 overflow-auto rounded bg-surface-100 p-3 font-mono text-xs dark:bg-surface-900"
          >
            {evidenceJson}
          </pre>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/components/insights/__tests__/InsightEvidenceDrawer.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/InsightEvidenceDrawer.tsx src/components/insights/__tests__/InsightEvidenceDrawer.test.tsx
git commit -m "feat(insights): InsightEvidenceDrawer with raw numbers + JSON"
```

---

## Task 12: `InsightCard` component

**Files:**

- Create: `src/components/insights/InsightCard.tsx`
- Create: `src/components/insights/__tests__/InsightCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/insights/__tests__/InsightCard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InsightCard } from "../InsightCard";
import type { AthleteInsightWire } from "@/lib/insights/types";

function fixture(overrides: Partial<AthleteInsightWire> = {}): AthleteInsightWire {
  return {
    id: "i1",
    athleteId: "a1",
    category: "TRAINING_PATTERN",
    metric: "m1",
    event: "SHOT_PUT",
    title: "Your best shot put throws follow 8kg shot weeks",
    body: "Weeks with more 8kg shot sessions tend to produce stronger throws.",
    detail: "Pattern strength: Medium — based on 12 weeks of data.",
    confidenceBand: "MEDIUM",
    dataPoints: 12,
    coefficient: 0.68,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    readByCoachAt: null,
    readByAthleteAt: null,
    dismissedAt: null,
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: null,
    computedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

// Stub IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  static last: MockIntersectionObserver | null = null;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIntersectionObserver.last = this;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting, target: document.body } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

describe("InsightCard", () => {
  beforeEach(() => {
    (
      global as unknown as { IntersectionObserver: typeof MockIntersectionObserver }
    ).IntersectionObserver = MockIntersectionObserver;
  });

  it("renders title, body, detail, band label", () => {
    render(
      <InsightCard insight={fixture()} role="ATHLETE" onMarkRead={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(screen.getByText("Your best shot put throws follow 8kg shot weeks")).toBeInTheDocument();
    expect(screen.getByText(/Weeks with more 8kg shot sessions/)).toBeInTheDocument();
    expect(screen.getByText(/Pattern strength: Medium/)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
  });

  it("shows NEW dot when unread for caller's role", () => {
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: null })}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByTestId("insight-new-dot")).toBeInTheDocument();
  });

  it("hides NEW dot when already read for caller's role", () => {
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: "2026-04-01T00:00:00.000Z" })}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.queryByTestId("insight-new-dot")).toBeNull();
  });

  it("evidence button only renders for COACH role", () => {
    const { rerender } = render(
      <InsightCard
        insight={fixture()}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
        onShowEvidence={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /evidence/i })).toBeNull();

    rerender(
      <InsightCard
        insight={fixture()}
        role="COACH"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
        onShowEvidence={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /evidence/i })).toBeInTheDocument();
  });

  it("fires onMarkRead once on viewport entry for unread insight", () => {
    const onMarkRead = vi.fn();
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: null })}
        role="ATHLETE"
        onMarkRead={onMarkRead}
        onDismiss={vi.fn()}
      />
    );
    act(() => {
      MockIntersectionObserver.last?.trigger(true);
    });
    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onMarkRead).toHaveBeenCalledWith("i1");

    // Second entry should NOT re-fire
    act(() => {
      MockIntersectionObserver.last?.trigger(true);
    });
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("does not fire onMarkRead for already-read insight", () => {
    const onMarkRead = vi.fn();
    render(
      <InsightCard
        insight={fixture({ readByAthleteAt: "2026-04-01T00:00:00.000Z" })}
        role="ATHLETE"
        onMarkRead={onMarkRead}
        onDismiss={vi.fn()}
      />
    );
    act(() => {
      MockIntersectionObserver.last?.trigger(true);
    });
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("dismiss click fires onDismiss with insight id", () => {
    const onDismiss = vi.fn();
    render(
      <InsightCard insight={fixture()} role="ATHLETE" onMarkRead={vi.fn()} onDismiss={onDismiss} />
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("i1");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npm test -- src/components/insights/__tests__/InsightCard.test.tsx
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```tsx
// src/components/insights/InsightCard.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, Dumbbell, Heart } from "lucide-react";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insight: AthleteInsightWire;
  role: "COACH" | "ATHLETE";
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onShowEvidence?: (id: string) => void;
};

const CATEGORY_ICON = {
  TRAINING_PATTERN: Activity,
  LIFT_THROW: Dumbbell,
  READINESS_COMPETITION: Heart,
} as const;

const BAND_CLASSES: Record<"WEAK" | "MEDIUM" | "STRONG", string> = {
  WEAK: "bg-surface-200 text-muted dark:bg-surface-800",
  MEDIUM: "bg-warning-500/20 text-warning-500",
  STRONG: "bg-primary-500/20 text-primary-500",
};

export function InsightCard({ insight, role, onMarkRead, onDismiss, onShowEvidence }: Props) {
  const readKey = role === "COACH" ? insight.readByCoachAt : insight.readByAthleteAt;
  const isUnread = readKey == null;
  const [hasFiredRead, setHasFiredRead] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const Icon = CATEGORY_ICON[insight.category];

  useEffect(() => {
    if (!isUnread || hasFiredRead) return;
    if (typeof window === "undefined") return;
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasFiredRead) {
            setHasFiredRead(true);
            onMarkRead(insight.id);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px", threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [insight.id, isUnread, hasFiredRead, onMarkRead]);

  return (
    <article ref={cardRef} className="card relative p-4" data-testid={`insight-card-${insight.id}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${BAND_CLASSES[insight.confidenceBand]}`}
          >
            {insight.confidenceBand}
          </span>
        </div>
        {isUnread && (
          <span
            data-testid="insight-new-dot"
            aria-label="New insight"
            className="h-2 w-2 rounded-full bg-primary-500"
          />
        )}
      </header>

      <h3 className="mt-3 font-heading text-base">{insight.title}</h3>
      <p className="mt-2 text-sm">{insight.body}</p>
      {insight.detail && <p className="mt-1 text-xs text-muted">{insight.detail}</p>}

      <footer className="mt-4 flex items-center justify-between gap-2">
        {role === "COACH" && onShowEvidence ? (
          <button
            type="button"
            onClick={() => onShowEvidence(insight.id)}
            className="text-xs text-primary-500 hover:underline"
          >
            Evidence →
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onDismiss(insight.id)}
          className="text-xs text-muted hover:text-danger-500"
        >
          Dismiss
        </button>
      </footer>
    </article>
  );
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test -- src/components/insights/__tests__/InsightCard.test.tsx
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/InsightCard.tsx src/components/insights/__tests__/InsightCard.test.tsx
git commit -m "feat(insights): InsightCard with role-aware controls + IO mark-read"
```

---

## Task 13: `InsightList` component

**Files:**

- Create: `src/components/insights/InsightList.tsx`
- Create: `src/components/insights/__tests__/InsightList.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/insights/__tests__/InsightList.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsightList } from "../InsightList";
import type { AthleteInsightWire } from "@/lib/insights/types";

function row(
  overrides: Partial<AthleteInsightWire> & Pick<AthleteInsightWire, "id" | "category">
): AthleteInsightWire {
  return {
    athleteId: "a1",
    metric: "m",
    event: null,
    title: `Title ${overrides.id}`,
    body: "body",
    detail: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    readByCoachAt: null,
    readByAthleteAt: "2026-04-01T00:00:00.000Z",
    dismissedAt: null,
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: null,
    computedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("InsightList", () => {
  it("renders EmptyState when insights is empty", () => {
    render(<InsightList insights={[]} role="ATHLETE" onMarkRead={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/No insights yet/i)).toBeInTheDocument();
  });

  it("renders section headers only for non-empty categories", () => {
    render(
      <InsightList
        insights={[
          row({ id: "t1", category: "TRAINING_PATTERN" }),
          row({ id: "l1", category: "LIFT_THROW" }),
        ]}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText(/Training Patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength ↔ Throws/i)).toBeInTheDocument();
    expect(screen.queryByText(/Readiness ↔ Competition/i)).toBeNull();
  });

  it("groups cards under their category headers", () => {
    render(
      <InsightList
        insights={[
          row({ id: "t1", category: "TRAINING_PATTERN" }),
          row({ id: "t2", category: "TRAINING_PATTERN" }),
          row({ id: "l1", category: "LIFT_THROW" }),
          row({ id: "r1", category: "READINESS_COMPETITION" }),
        ]}
        role="ATHLETE"
        onMarkRead={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/insight-card-/)).toHaveLength(4);
    expect(screen.getByText(/Training Patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength ↔ Throws/i)).toBeInTheDocument();
    expect(screen.getByText(/Readiness ↔ Competition/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- src/components/insights/__tests__/InsightList.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/components/insights/InsightList.tsx
"use client";
import { InsightCard } from "./InsightCard";
import { InsightEmptyState } from "./InsightEmptyState";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  insights: AthleteInsightWire[];
  role: "COACH" | "ATHLETE";
  athleteName?: string; // only used for coach empty state
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onShowEvidence?: (id: string) => void;
};

const CATEGORY_ORDER = ["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  TRAINING_PATTERN: "Training Patterns",
  LIFT_THROW: "Strength ↔ Throws",
  READINESS_COMPETITION: "Readiness ↔ Competition",
};

export function InsightList({
  insights,
  role,
  athleteName,
  onMarkRead,
  onDismiss,
  onShowEvidence,
}: Props) {
  if (insights.length === 0) {
    return <InsightEmptyState role={role} athleteName={athleteName} />;
  }

  const groups = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: insights.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            {CATEGORY_LABEL[group.category]}
          </h2>
          <div className="space-y-3">
            {group.items.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                role={role}
                onMarkRead={onMarkRead}
                onDismiss={onDismiss}
                onShowEvidence={onShowEvidence}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

Note: The plan originally called for `<StaggeredList>` wrapping but the list-within-category structure makes that require nested stagger containers. MVP skips the stagger to keep the component simple; revisit if the entry animation is missed.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/components/insights/__tests__/InsightList.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/InsightList.tsx src/components/insights/__tests__/InsightList.test.tsx
git commit -m "feat(insights): InsightList with category grouping + empty state"
```

---

## Task 14: Athlete insights page

**Files:**

- Create: `src/app/(dashboard)/athlete/insights/page.tsx`
- Create: `src/app/(dashboard)/athlete/insights/_insights-client.tsx`

- [ ] **Step 1: Server component**

```tsx
// src/app/(dashboard)/athlete/insights/page.tsx
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { toWire } from "@/lib/insights/serialize";
import { AthleteInsightsClient } from "./_insights-client";

export default async function AthleteInsightsPage() {
  const session = await getSession();
  if (!session) return notFound();

  const profile = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!profile) return notFound();

  // Latest-per-slot, non-dismissed
  const rawRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT DISTINCT ON ("athleteId", "category", "metric") *
    FROM "AthleteInsight"
    WHERE "athleteId" = ${profile.id}
      AND "dismissedAt" IS NULL
    ORDER BY "athleteId", "category", "metric", "computedAt" DESC
    LIMIT 50
  `);

  // rawRows come from $queryRaw with Date fields as Date objects; coerce via toWire
  const insights = rawRows.map((row) => toWire(row as unknown as Parameters<typeof toWire>[0]));

  return <AthleteInsightsClient athleteId={profile.id} initialInsights={insights} />;
}
```

- [ ] **Step 2: Client component**

```tsx
// src/app/(dashboard)/athlete/insights/_insights-client.tsx
"use client";
import { useState, useCallback, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { InsightList } from "@/components/insights/InsightList";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  athleteId: string;
  initialInsights: AthleteInsightWire[];
};

export function AthleteInsightsClient({ athleteId, initialInsights }: Props) {
  const toast = useToast();
  const [insights, setInsights] = useState(initialInsights);
  const [showDismissed, setShowDismissed] = useState(false);
  const [isRecomputing, startRecomputing] = useTransition();

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/insights/${id}/read`, { method: "PATCH" });
      setInsights((prev) =>
        prev.map((i) => (i.id === id ? { ...i, readByAthleteAt: new Date().toISOString() } : i))
      );
    } catch (err) {
      // Mark-read failures are silent — worst case, NEW dot stays until next load.
      // Per project rule #1 we still log to console.
      console.error("mark read failed", err);
    }
  }, []);

  const dismiss = useCallback(
    async (id: string) => {
      const prev = insights;
      setInsights(prev.filter((i) => i.id !== id)); // optimistic
      try {
        const res = await fetch(`/api/insights/${id}/dismiss`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to dismiss");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to dismiss");
        setInsights(prev); // rollback
      }
    },
    [insights, toast]
  );

  const toggleDismissed = async () => {
    const next = !showDismissed;
    setShowDismissed(next);
    try {
      const res = await fetch(
        `/api/insights?athleteId=${athleteId}&mode=latest&includeDismissed=${next}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load");
      }
      setInsights(json.data.insights as AthleteInsightWire[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      setShowDismissed(!next); // rollback toggle
    }
  };

  const recompute = () => {
    startRecomputing(async () => {
      try {
        const res = await fetch(`/api/insights/compute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Failed to recompute");
        }
        toast.success(
          json.data.persistedCount === 0
            ? "No new insights"
            : `${json.data.persistedCount} insights updated`
        );
        // Refresh the list
        const listRes = await fetch(
          `/api/insights?athleteId=${athleteId}&mode=latest&includeDismissed=${showDismissed}`
        );
        const listJson = await listRes.json();
        if (listRes.ok && listJson.success) {
          setInsights(listJson.data.insights as AthleteInsightWire[]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to recompute");
      }
    });
  };

  return (
    <div className="relative">
      <ScrollProgressBar />
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl">Insights</h1>
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showDismissed} onChange={toggleDismissed} />
              <span className="text-muted">Show dismissed</span>
            </label>
            <button
              type="button"
              onClick={recompute}
              disabled={isRecomputing}
              className="btn-secondary text-xs"
            >
              {isRecomputing ? "Recomputing..." : "Recompute"}
            </button>
          </div>
        </header>

        <InsightList insights={insights} role="ATHLETE" onMarkRead={markRead} onDismiss={dismiss} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npx tsc --noEmit && npm run lint
```

Expected: 0 errors. (The existing sidebar-resolution test will stay red for the NEW athlete `/insights` href until Task 16 adds it — that's fine, not a new failure.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/insights/"
git commit -m "feat(insights): athlete insights page with recompute + show-dismissed"
```

---

## Task 15: Coach insights section on athlete detail page

**Files:**

- Create: `src/app/(dashboard)/coach/athletes/[id]/_coach-insights-section.tsx`
- Modify: `src/app/(dashboard)/coach/athletes/[id]/page.tsx`
- Modify: `src/app/(dashboard)/coach/athletes/[id]/_section-nav.tsx`

- [ ] **Step 1: Create the client section component**

```tsx
// src/app/(dashboard)/coach/athletes/[id]/_coach-insights-section.tsx
"use client";
import { useState, useCallback, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { InsightList } from "@/components/insights/InsightList";
import { InsightEvidenceDrawer } from "@/components/insights/InsightEvidenceDrawer";
import type { AthleteInsightWire } from "@/lib/insights/types";

type Props = {
  athleteId: string;
  athleteName: string;
  initialInsights: AthleteInsightWire[];
};

export function CoachInsightsSection({ athleteId, athleteName, initialInsights }: Props) {
  const toast = useToast();
  const [insights, setInsights] = useState(initialInsights);
  const [showDismissed, setShowDismissed] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<AthleteInsightWire | null>(null);
  const [isRecomputing, startRecomputing] = useTransition();

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/insights/${id}/read`, { method: "PATCH" });
      setInsights((prev) =>
        prev.map((i) => (i.id === id ? { ...i, readByCoachAt: new Date().toISOString() } : i))
      );
    } catch (err) {
      console.error("mark read failed", err);
    }
  }, []);

  const dismiss = useCallback(
    async (id: string) => {
      const prev = insights;
      setInsights(prev.filter((i) => i.id !== id));
      try {
        const res = await fetch(`/api/insights/${id}/dismiss`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to dismiss");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to dismiss");
        setInsights(prev);
      }
    },
    [insights, toast]
  );

  const showEvidence = (id: string) => {
    const found = insights.find((i) => i.id === id);
    if (found) setEvidenceFor(found);
  };

  const toggleDismissed = async () => {
    const next = !showDismissed;
    setShowDismissed(next);
    try {
      const res = await fetch(
        `/api/insights?athleteId=${athleteId}&mode=latest&includeDismissed=${next}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load");
      setInsights(json.data.insights as AthleteInsightWire[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      setShowDismissed(!next);
    }
  };

  const recompute = () => {
    startRecomputing(async () => {
      try {
        const res = await fetch(`/api/insights/compute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to recompute");
        toast.success(
          json.data.persistedCount === 0
            ? "No new insights"
            : `${json.data.persistedCount} insights updated`
        );
        const listRes = await fetch(
          `/api/insights?athleteId=${athleteId}&mode=latest&includeDismissed=${showDismissed}`
        );
        const listJson = await listRes.json();
        if (listRes.ok && listJson.success) {
          setInsights(listJson.data.insights as AthleteInsightWire[]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to recompute");
      }
    });
  };

  return (
    <section id="insights" className="scroll-mt-20 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl">Insights</h2>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showDismissed} onChange={toggleDismissed} />
            <span className="text-muted">Show dismissed</span>
          </label>
          <button
            type="button"
            onClick={recompute}
            disabled={isRecomputing}
            className="btn-secondary text-xs"
          >
            {isRecomputing ? "Recomputing..." : "Recompute"}
          </button>
        </div>
      </header>

      <InsightList
        insights={insights}
        role="COACH"
        athleteName={athleteName}
        onMarkRead={markRead}
        onDismiss={dismiss}
        onShowEvidence={showEvidence}
      />

      {evidenceFor && (
        <InsightEvidenceDrawer insight={evidenceFor} onClose={() => setEvidenceFor(null)} />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add "insights" to the section nav**

Open `src/app/(dashboard)/coach/athletes/[id]/_section-nav.tsx` and append to the `SECTIONS` array:

```ts
const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "training", label: "Training" },
  { id: "throws", label: "Throws" },
  { id: "readiness", label: "Readiness" },
  { id: "wellness", label: "Wellness" },
  { id: "goals", label: "Goals" },
  { id: "insights", label: "Insights" },
];
```

- [ ] **Step 3: Render the new section in `page.tsx`**

Open `src/app/(dashboard)/coach/athletes/[id]/page.tsx`. Near the other section rendering (below "goals" or wherever the last section lives), fetch the insights and render the new component.

Before the existing `return ...`:

```ts
import { Prisma } from "@prisma/client";
import { CoachInsightsSection } from "./_coach-insights-section";
import { toWire } from "@/lib/insights/serialize";
// ... (other imports unchanged)
```

Inside the page's async data-fetching block (near where the athlete profile is loaded):

```ts
const insightRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
  SELECT DISTINCT ON ("athleteId", "category", "metric") *
  FROM "AthleteInsight"
  WHERE "athleteId" = ${athleteId}
    AND "dismissedAt" IS NULL
  ORDER BY "athleteId", "category", "metric", "computedAt" DESC
  LIMIT 50
`);
const insights = insightRows.map((row) => toWire(row as unknown as Parameters<typeof toWire>[0]));
const athleteName =
  `${athlete.firstName ?? ""} ${athlete.lastName ?? ""}`.trim() || athlete.user?.email || "Athlete";
```

In the JSX, after the last existing section (likely `<section id="goals">...</section>`), add:

```tsx
<CoachInsightsSection athleteId={athleteId} athleteName={athleteName} initialInsights={insights} />
```

Don't remove or reorder the existing sections. If the existing page's data-fetch block uses different variable names (e.g., `athlete.id` vs the URL `athleteId` param), adapt.

- [ ] **Step 4: Typecheck + lint**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/"
git commit -m "feat(insights): coach athlete-detail insights section + nav entry"
```

---

## Task 16: Athlete sidebar nav entry

**Files:**

- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Locate the athlete nav sections**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
grep -n "ATHLETE_NAV_SECTIONS\|athlete.*Competitions" src/components/ui/Sidebar.tsx | head -5
```

- [ ] **Step 2: Add "Insights" entry near "Competitions"**

The previous B work added a `Competitions` entry in the athlete nav (first section in `ATHLETE_NAV_SECTIONS`). Add `Insights` immediately after it, using the `Sparkles` icon:

Add to the import list at the top:

```ts
import { Sparkles } from "lucide-react";
```

And inside the athlete nav section array, after `Competitions`:

```ts
{ label: "Insights", href: "/athlete/insights", icon: Sparkles, ...iconSize },
```

(Match the existing formatting — if entries are defined inline without destructuring, follow that style.)

- [ ] **Step 3: Run sidebar-resolution test**

```bash
npm test -- src/__tests__/nav/sidebar-resolution.test.ts
```

Expected: Test should still fail ONLY on the pre-existing coach `Throws → /coach/athletes?tab=throws` entry. The new athlete `Insights` entry must resolve cleanly to `/athlete/insights/page.tsx` (created in Task 14).

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/ui/Sidebar.tsx
git commit -m "feat(nav): athlete insights sidebar entry"
```

---

## Task 17: Full verification pass

**Files:** none

- [ ] **Step 1: Typecheck**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.worktrees/insight-delivery-mvp"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: "No ESLint warnings or errors".

- [ ] **Step 3: Full test suite**

```bash
npm test
```

Expected: all tests pass EXCEPT the pre-existing sidebar-resolution failure on `Throws → /coach/athletes?tab=throws`. New tests added: ~30+ across notify / persist / read / dismiss / GET filter / InsightCard / InsightList / InsightEvidenceDrawer. Count should be in the 320+ range passing with 1 known pre-existing failure.

If any NEW test fails, STOP and report as BLOCKED.

- [ ] **Step 4: Manual dev-server walkthrough**

```bash
npm run dev
```

Then in a browser:

1. Log in as `coach@example.com` / `coach123`
2. Visit `/coach/athletes/<any-id>` and scroll to the Insights section — should render cards (or empty state if the athlete has no data)
3. Click "Evidence" on a card → drawer opens showing raw numbers. Close with X or Escape.
4. Click "Dismiss" on a card → card disappears. Toggle "Show dismissed" → card reappears.
5. Click "Recompute" → toast appears with count. Second click within 60s → rate-limit toast.
6. Log out, log in as `athlete1@example.com` / `athlete123`
7. Visit `/athlete/insights` — same cards, NO Evidence button on any card.
8. Force a new-slot notification: via Prisma Studio or direct DB, delete one `AthleteInsight` row so its `(category, metric)` reappears on next compute. Click Recompute. Check the notification dropdown — new `INSIGHT_NEW` notification should appear for the athlete AND (in a second browser session) for the linked coach.
9. Click Recompute again without changing data. No new notification should fire.

- [ ] **Step 5: Confirm no-regression in sub-project B tests**

```bash
npm test -- src/lib/insights/__tests__/runInsights.test.ts src/app/api/insights/__tests__/insights.test.ts src/app/api/insights/compute/__tests__/compute.test.ts
```

Expected: all green.

---

## Task 18: Update Notion Activity Log

**Files:** none

- [ ] **Step 1: Create Activity Log entry in Notion**

Using the `mcp__claude_ai_Notion__notion-create-pages` tool, parent `data_source_id: ff7d9578-fe8d-4d1e-bfcb-884abd75cee2`, with:

- `Task`: "Ship insight delivery MVP (sub-project C-MVP)"
- `Category`: Feature
- `Status`: Completed
- `Impact`: High
- `Description`: Paragraph summarizing what shipped — pages, endpoints, notification, default visibility, no schema changes
- `date:Date:start`: today
- `Files Changed`: key file paths
- `Commit`: HEAD commit SHA after the final commit
- `Branch`: `feat/insight-delivery-mvp`

This is a record-keeping step; the CLAUDE.md Notion logging convention requires it after any meaningful feature ship.

---

## Self-Review Checklist

Before handing off:

- [ ] Every task has concrete code, exact file paths, and explicit commands — no TBDs
- [ ] No schema changes — all insight columns from sub-project B are sufficient
- [ ] Notification fires ONLY on new `(category, metric)` slots, not on recomputes of existing slots
- [ ] Athlete notifications always fire; coach suppressed when `isSelfCoached: true`
- [ ] `readByCoachAt` / `readByAthleteAt` are per-role; dismiss is shared
- [ ] `IntersectionObserver` mark-read fires once, guarded by `hasFiredRead` state
- [ ] Evidence drawer is coach-only via role prop check on `InsightCard`
- [ ] Overlay uses `bg-[var(--surface-overlay)]` per project rule; backdrop uses opacity-suffix only on the scrim
- [ ] Coach integration adds an inline section to the existing athlete detail page (NOT a new route) — matches `_section-nav.tsx` pattern
- [ ] Athlete side adds a dedicated route and sidebar entry
- [ ] All fetch paths surface errors via `toast.error` + optimistic rollback per project rule #1
- [ ] No mutations to sub-project B analyzer files — only `persist.ts` (additive) and `types.ts` (additive)

## Out-of-scope reminders (stop and ask)

- Coach-per-athlete visibility customization → C-CONFIG
- Per-role dismiss columns → C-CONFIG
- Band-transition / effect-size threshold notifications → C-CONFIG
- Weekly cron / roster-aggregate → C-DIGEST
- LLM prose → C-LLM
- Email / push delivery → platform-level, not this spec
- Dashboard widget embed → defer
- Athlete-side notification pref check (uses `AthleteProfile.notificationPreferences`) → C-CONFIG
