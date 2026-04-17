# Insight Delivery MVP — Design

**Status:** Draft · awaiting user review
**Date:** 2026-04-17
**Sub-project:** C-MVP of the decomposed C initiative

## Context

Third sub-project of the competition + trend-analysis initiative:

- **A. Competition Logging v2** — _shipped_ 2026-04-17; structured per-throw meet logging
- **B. Trend Insight Layer** — _shipped_ 2026-04-17; analyzers + templates + `AthleteInsight` persistence + `waitUntil(runInsights)` trigger
- **C. Insight Delivery + Permissions** _(this initiative)_ — originally one spec, decomposed into four:
  - **C-MVP** _(this spec)_ — pages that render the insights, read/dismiss endpoints, `INSIGHT_NEW` notifications, default visibility rules
  - **C-CONFIG** _(future)_ — coach-per-athlete customization of what athletes see
  - **C-DIGEST** _(future)_ — weekly/scheduled cron summarizing roster-level insights
  - **C-LLM** _(optional polish)_ — LLM-generated richer detail prose via Vercel AI Gateway
- **D. Expanded Data Collection** — optional, deferred

## Goal

Get sub-project B's persisted insights in front of coaches and athletes. Ship two dedicated pages, two mutation endpoints (mark-read, dismiss), a single new notification type fired conservatively (first-time slot only), and a role-based default visibility rule — without building any customization UI, cron, or LLM layer.

## Non-goals

- Coach-per-athlete visibility customization — C-CONFIG
- Per-role dismiss columns (distinct coach vs athlete dismiss state) — C-CONFIG
- Band-transition notifications (WEAK→MEDIUM→STRONG fires a new notification) — C-CONFIG
- Effect-size threshold notifications — C-CONFIG
- Weekly / scheduled digest cron — C-DIGEST
- Roster-aggregate view for coaches — C-DIGEST
- Email / SMS delivery for `INSIGHT_NEW` — platform-level work, not this spec
- LLM-generated detail prose — C-LLM
- Dashboard widget embed — insights live on their dedicated pages only
- Insight sharing / export / PDF
- Coach comment threads on insights
- Schema changes — C-MVP uses the columns sub-project B already shipped

## Decisions made during brainstorming

| Decision                  | Chosen option                                                                                                                                     | Why                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Default visibility        | Both roles see title + body + detail + band label. Coach additionally gets Evidence drawer with raw numbers. Athlete never sees raw coefficients. | Sensible default that needs zero customization data. Athletes get the "what," coaches get the "what + why." |
| Page locations            | Dedicated `/athlete/insights` + `/coach/athletes/[id]/insights` (linked from coach athlete detail)                                                | Clean separation; athlete gets a top-level nav entry; coach entry is contextual to each athlete             |
| Notification trigger      | First-time `(category, metric)` slot only                                                                                                         | ~5-15 notifications per athlete per season, not 150; each slot notifies exactly once ever                   |
| Notification recipients   | Athlete always; coach when linked + athlete is not self-coached                                                                                   | Matches the `notifyCompetitionEvent` pattern from sub-project A                                             |
| Batching                  | One notification per recipient per persist batch, regardless of how many new slots surfaced                                                       | Prevents burst spam; body mentions count if >1                                                              |
| Read state                | Per-role (`readByCoachAt` vs `readByAthleteAt`)                                                                                                   | Coach reading doesn't dismiss the "NEW" badge for athlete                                                   |
| Dismiss state             | Shared single column (`dismissedAt`) for MVP                                                                                                      | Keeps schema flat; per-role dismiss is C-CONFIG if coaches ask for it                                       |
| Read semantics            | `IntersectionObserver` fires PATCH `read` once on first viewport entry                                                                            | Automatic; user doesn't have to click anything                                                              |
| Recompute trigger         | Manual recompute button on both pages hits existing `POST /api/insights/compute`                                                                  | Reuses sub-project B rate-limited endpoint                                                                  |
| `includeDismissed` filter | Extend existing `GET /api/insights` with query param                                                                                              | Same endpoint, same shape — flag flips the filter                                                           |
| Roster aggregation        | Deferred                                                                                                                                          | C-DIGEST scope                                                                                              |

---

## Architecture Overview

### Where it sits

```
existing (sub-project B):
  src/lib/insights/                      ← analyzers, templates, orchestrator, persist, notify helper
  prisma.athleteInsight                  ← append-only rows with readByCoachAt / readByAthleteAt / dismissedAt columns
  GET /api/insights                      ← list endpoint with mode=latest|all + category filter

NEW (this spec):
  src/lib/insights/notify.ts             ← new file: notifyInsightsNew helper
  src/lib/insights/persist.ts            ← extended: prior-slot lookup + notify call
  src/lib/insights/serialize.ts          ← new: toWire() for Date→ISO conversion
  src/lib/insights/types.ts              ← extended: AthleteInsightWire type
  src/lib/notifications.ts               ← extended: "INSIGHT_NEW" added to NotificationType union
  src/lib/api-schemas.ts                 ← extended: InsightDismissSchema + includeDismissed on list schema

  src/app/api/insights/route.ts                     ← extended: includeDismissed filter
  src/app/api/insights/[id]/read/route.ts           ← new
  src/app/api/insights/[id]/dismiss/route.ts        ← new

  src/components/insights/
    InsightCard.tsx                      ← shared card with role-aware controls
    InsightList.tsx                      ← grouped by category
    InsightEvidenceDrawer.tsx            ← coach-only raw numbers panel
    InsightEmptyState.tsx                ← audience-aware empty copy

  src/app/(dashboard)/athlete/insights/
    page.tsx                             ← server component
    _insights-client.tsx                 ← client renderer

  src/app/(dashboard)/coach/athletes/[id]/insights/
    page.tsx                             ← server component
    _coach-insights-client.tsx           ← client renderer (with Evidence)

  src/components/ui/Sidebar.tsx          ← add Athlete → Insights nav entry
  coach athlete detail page              ← add Insights tab/link
```

### Key invariants

- Athletes see only their own insights (existing `canAccessAthlete` gate in the list API).
- Coaches see insights for athletes they have `canAccessAthlete` access to.
- `INSIGHT_NEW` fires only on a NEW `(category, metric)` slot — existing slots recompute silently.
- Dismiss hides from the default list but preserves the row. `includeDismissed=true` surfaces dismissed rows.
- Read state is per-role; dismiss is shared.
- No existing sub-project B file is modified except `persist.ts` (additive — prior-slot lookup + notify call) and `types.ts` (additive — new type export).

---

## Pages

### Athlete insights — `/athlete/insights`

**Server component** at `src/app/(dashboard)/athlete/insights/page.tsx`:

- Resolves logged-in user's `athleteId` via `getSession()` + profile lookup; 404 if absent
- Server-fetches latest-per-slot insights via direct Prisma call (same latest-per-slot logic the list API uses — share the raw SQL via a helper)
- Serializes via `toWire()` and passes to `_insights-client.tsx`

**Client component** `_insights-client.tsx`:

- Renders `<InsightList insights={...} role="ATHLETE">`
- "Show dismissed" toggle — re-fetches with `includeDismissed=true` via `GET /api/insights`
- "Recompute" button — POSTs to `/api/insights/compute`; displays toast on success; respects existing 60s rate limit (429 → toast.error)
- `<ScrollProgressBar />` at top per project convention
- Empty state via `<InsightEmptyState role="ATHLETE">` when list is empty

### Coach athlete-insights — `/coach/athletes/[id]/insights`

**Server component** at `src/app/(dashboard)/coach/athletes/[id]/insights/page.tsx`:

- Takes `athleteId` from URL, verifies coach access via `canAccessAthlete`, 404 otherwise
- Same server-fetch + `toWire()` pattern
- Passes to `_coach-insights-client.tsx`

**Client component** `_coach-insights-client.tsx`:

- Renders `<InsightList insights={...} role="COACH">`
- Header strip: athlete name, avatar, events, link back to roster
- Same "Show dismissed" + "Recompute" affordances
- Evidence button on each card opens `<InsightEvidenceDrawer>`

### Sidebar nav

- **Athlete sidebar**: add "Insights" entry with `Trophy` icon replaced by `Sparkles` (`strokeWidth={1.75}`), positioned near "Competitions"
- **Coach sidebar**: no new entry. The coach insights page is a contextual sub-route of athlete detail, accessed via the athlete detail page's tab/link.

### Coach athlete detail integration

The existing coach athlete detail page (`/coach/athletes/[id]/page.tsx`) already renders tabs or sections. Add an "Insights" tab/link routing to `/coach/athletes/[id]/insights`. During implementation, grep the existing file for the tab pattern and follow it; don't invent a new navigation style.

### Explicit non-features

- No dashboard embed — insights live on dedicated pages only
- No filter controls beyond category grouping + dismissed toggle
- No per-insight detail page — card + drawer is the full surface
- No search, sort, or event-filter UI

---

## Components

All under `src/components/insights/`.

### `InsightCard.tsx`

Core render unit. Props:

```ts
type Props = {
  insight: AthleteInsightWire;
  role: "COACH" | "ATHLETE";
  onMarkRead: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onShowEvidence?: (id: string) => void;
};
```

Layout:

- Top-left: category icon (Lucide `Activity` / `Dumbbell` / `Heart`, `strokeWidth={1.75}`)
- Top-right: band pill (`text-xs uppercase`; WEAK=muted gray, MEDIUM=amber, STRONG=primary gold), NEW dot when unread for caller's role
- Middle: title (`font-heading text-base`), body, detail (`text-sm text-muted`)
- Bottom: Evidence button (coach only), Dismiss button

Behavior:

- Uses plain `card` class (static, not `card-interactive` — tapping doesn't navigate)
- `IntersectionObserver` fires `onMarkRead(id)` once on first viewport entry if the insight is unread for the caller's role
- Dismiss is optimistic — local removal, server PATCH, rollback + `toast.error` on failure per project rule #1
- No new animation code — respects `prefers-reduced-motion` via the underlying `card` class

### `InsightList.tsx`

Groups by category. Props:

```ts
type Props = {
  insights: AthleteInsightWire[];
  role: "COACH" | "ATHLETE";
  onMarkRead: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onShowEvidence?: (id: string) => void;
};
```

- Three section headers: "Training Patterns" / "Strength ↔ Throws" / "Readiness ↔ Competition" (uses project's section-header style: `text-sm font-semibold text-muted uppercase tracking-wider`)
- Each section wraps its `<InsightCard>` rows in `<StaggeredList>` for entry animation (50ms stagger)
- Empty category sections are hidden entirely (no header without cards)
- If all sections are empty, renders `<InsightEmptyState role={role}>` instead

### `InsightEvidenceDrawer.tsx` (coach-only)

Modal/sheet with opaque `bg-[var(--surface-overlay)]` per project overlay rule. Contents:

- Header: "Evidence for {insight.title}"
- Raw numbers table: `coefficient` (labeled "Pearson r" or "slope"), `effectSize` + `effectUnit`, `dataPoints`, `confidenceBand`, `computedAt`, `triggerKind`, `triggerMeetId` (linked to meet detail if present)
- `evidence` JSON pretty-printed in a scrollable `<pre>` with `font-mono`
- Close button + Escape key handling

No mutations from the drawer. Strictly read-only.

### `InsightEmptyState.tsx`

Two audience variants. Plain `card`, centered, project typography.

**Athlete:**

> **No insights yet.**
> Your insights appear here once there's enough data to find patterns — typically after a few weeks of logged sessions and a couple of meets.
> [Log a practice session →] [Log a competition →]

**Coach:**

> **No insights yet for {athlete.name}.**
> Insights require minimum data: 5 weeks of practice for training patterns, 6 paired training windows for lift-throw correlations, 4 competitions for readiness-competition correlations.
> [Back to roster →]

---

## Notification Trigger

### New type

`src/lib/notifications.ts` gains `"INSIGHT_NEW"` in its `NotificationType` union. `CoachProfile.notificationPreferences.inApp["INSIGHT_NEW"]` defaults TRUE via the existing "missing keys default to TRUE" convention — no migration, no default-value sprinkle.

### Firing rule

In `src/lib/insights/persist.ts`, before the `createMany`, look up which `(category, metric)` slots exist for this athlete. After the write, fire `notifyInsightsNew` with the subset whose slot is brand-new.

```ts
const priorSlots = await prisma.athleteInsight.findMany({
  where: { athleteId, metric: { in: items.map((i) => i.metric) } },
  select: { category: true, metric: true },
});
const seenSet = new Set(priorSlots.map((p) => `${p.category}:${p.metric}`));

const result = await prisma.athleteInsight.createMany({ data: rows });

const newSlotItems = items.filter((i) => !seenSet.has(`${i.category}:${i.metric}`));
if (newSlotItems.length > 0) {
  void notifyInsightsNew(athleteId, newSlotItems).catch((err) => {
    logger.error("insight notification dispatch failed", { athleteId, error: err });
  });
}

return result.count;
```

### `src/lib/insights/notify.ts` — new file

```ts
export async function notifyInsightsNew(
  athleteId: string,
  newInsights: Array<{ category: InsightCategory; title: string; body: string }>
): Promise<void> {
  try {
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

    // Always notify the athlete
    await createNotification({
      type: "INSIGHT_NEW",
      title,
      body,
      athleteProfileId: athlete.id,
      metadata: {
        insightCount: newInsights.length,
        categories: newInsights.map((i) => i.category),
        href: "/athlete/insights",
      },
    });

    // Notify linked coach unless athlete is self-coached
    if (!athlete.isSelfCoached && athlete.coachId) {
      await createNotification({
        type: "INSIGHT_NEW",
        title: `${title} · ${athlete.user.email}`,
        body,
        coachId: athlete.coachId,
        metadata: {
          insightCount: newInsights.length,
          categories: newInsights.map((i) => i.category),
          href: `/coach/athletes/${athlete.id}/insights`,
        },
      });
    }
  } catch (err) {
    logger.error("notifyInsightsNew failed", { context: "insights/notify", error: err });
  }
}
```

### Properties

- One notification per recipient per batch — 3 new slots in one persist call = 1 notification per recipient saying "3 new insights"
- Fire-and-forget — try/catch wraps the whole body, logs on failure, never propagates
- `metadata.href` differs per recipient so the notification dropdown can deep-link to the right page

### What we do NOT notify on (for MVP)

- Band transitions (WEAK→MEDIUM→STRONG)
- Coefficient direction changes
- Effect-size threshold crossings
- Dismissed-insight resurfacing

All of these are reasonable C-CONFIG additions.

### Delivery channels

- **In-app** only — writes to the `Notification` table, surfaced via the existing notification dropdown
- **No email / push** — follows whatever existing pattern the codebase uses for other notification types; adding new channels is platform-level work, out of scope

---

## Read/Dismiss Endpoints

### `PATCH /api/insights/[id]/read`

No body. Sets `readByCoachAt` (coach role) or `readByAthleteAt` (athlete role) to `now` if the field is currently null. Idempotent — re-reading preserves the original timestamp.

```ts
export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

### `PATCH /api/insights/[id]/dismiss`

Optional body `{ undismiss?: true }`. Default sets `dismissedAt: new Date()`; `undismiss: true` sets it back to `null`.

Validated via new `InsightDismissSchema` in `src/lib/api-schemas.ts`:

```ts
export const InsightDismissSchema = z.object({
  undismiss: z.boolean().optional(),
});
```

Same auth + gate pattern as `read`. Returns `{ success: true, data: { id, dismissedAt: Date | null } }`.

### No rate limiting

Both endpoints are cheap user actions on specific rows. Standard auth gate is sufficient.

---

## Data Contracts

### Extension to `GET /api/insights`

Add `includeDismissed` to `InsightsListQuerySchema`:

```ts
export const InsightsListQuerySchema = z.object({
  athleteId: z.string().min(1),
  mode: z.enum(["latest", "all"]).optional().default("latest"),
  category: z.enum(["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  includeDismissed: z.coerce.boolean().optional().default(false),
});
```

Handler logic:

- `mode=latest` raw SQL: append `AND "dismissedAt" IS NULL` when `!includeDismissed`
- `mode=all` Prisma query: add `...(!includeDismissed ? { dismissedAt: null } : {})` to the where clause

### Wire type — `src/lib/insights/types.ts` (append)

```ts
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

### Serialization helper — `src/lib/insights/serialize.ts` (new)

```ts
import type { AthleteInsight } from "@prisma/client";
import type { AthleteInsightWire } from "./types";

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

Used by both server page components and the `GET /api/insights` handler so the shape is consistent everywhere.

---

## Testing

Per project TDD rule: tests first, watch them fail, implement.

### Notification helper — `src/lib/insights/__tests__/notify.test.ts` (new)

- Dual notification on new slot (athlete + linked coach)
- Self-coached suppresses coach notification
- Batch count in title (3 new slots → "3 new insights")
- Failure is swallowed (logged, not thrown)

### Persist extension — `src/lib/insights/__tests__/persist.test.ts` (new)

- New slots trigger notification
- Existing slots don't trigger
- Mixed slots filter correctly
- Notification failure doesn't fail persist
- Empty items short-circuit

### List endpoint extension — extend existing `insights.test.ts`

- `includeDismissed` default false filters out dismissed rows
- `includeDismissed=true` returns all
- Raw SQL branch applies dismiss filter

### Read endpoint — `src/app/api/insights/[id]/read/__tests__/read.test.ts`

- Coach sets `readByCoachAt`
- Athlete sets `readByAthleteAt`
- Idempotent on re-read
- 403 when `canAccessAthlete` fails
- 404 when insight not found

### Dismiss endpoint — `src/app/api/insights/[id]/dismiss/__tests__/dismiss.test.ts`

- Empty body sets `dismissedAt`
- `{ undismiss: true }` clears `dismissedAt`
- 403 / 404 paths

### Component tests — `src/components/insights/__tests__/*`

**InsightCard:**

- Renders title, body, detail, band label
- Band pill color class per band
- NEW dot shows when unread for role
- Evidence button only for COACH
- `onMarkRead` fires once on viewport entry
- Dismiss click fires callback

**InsightList:**

- Groups by category with section headers
- Empty sections hidden
- All-empty renders EmptyState
- StaggeredList wraps each group

**InsightEvidenceDrawer:**

- Raw numbers render
- Evidence JSON pretty-printed
- Close fires callback

### Page integration tests

- Server component 404s without session
- Server component passes serialized wire objects to client

### Sidebar regression guard

Existing test passes automatically once `/athlete/insights/page.tsx` exists.

### Manual E2E

Before marking C-MVP done:

1. Coach opens `/coach/athletes/<id>/insights` → sees grouped cards with band + title + body + detail
2. Click Evidence → drawer shows raw numbers
3. Dismiss → card disappears optimistically
4. Show dismissed → card reappears
5. Athlete opens `/athlete/insights` → same cards, no Evidence button
6. Force new-slot insight → see `INSIGHT_NEW` notification for both athlete and coach
7. Force same-slot recompute → NO new notification
8. Self-coached athlete → only athlete notification on new slot
9. `npx tsc --noEmit && npm run lint && npm test` — all green except pre-existing sidebar failure

---

## Deliverables

**Schema:** none.

**Library:**

- [ ] `src/lib/insights/notify.ts` — `notifyInsightsNew` helper
- [ ] `src/lib/insights/persist.ts` — extended with prior-slot lookup + notify call
- [ ] `src/lib/insights/serialize.ts` — `toWire()` helper
- [ ] `src/lib/insights/types.ts` — append `AthleteInsightWire`
- [ ] `src/lib/notifications.ts` — append `"INSIGHT_NEW"` to the union
- [ ] `src/lib/api-schemas.ts` — extend `InsightsListQuerySchema` with `includeDismissed`; append `InsightDismissSchema`

**API:**

- [ ] Extend `GET /api/insights` with `includeDismissed`
- [ ] `PATCH /api/insights/[id]/read` (new)
- [ ] `PATCH /api/insights/[id]/dismiss` (new)

**Components:**

- [ ] `InsightCard.tsx`
- [ ] `InsightList.tsx`
- [ ] `InsightEvidenceDrawer.tsx`
- [ ] `InsightEmptyState.tsx`

**Pages:**

- [ ] `/athlete/insights/page.tsx` + `_insights-client.tsx`
- [ ] `/coach/athletes/[id]/insights/page.tsx` + `_coach-insights-client.tsx`

**Nav + integration:**

- [ ] Athlete sidebar entry
- [ ] Coach athlete detail page link/tab

**Tests:** all categories above.

---

## Success Criteria

1. Coach opens `/coach/athletes/<id>/insights` for an athlete with sub-project B insights → grouped cards render with band label, title, body, detail. Evidence drawer opens showing raw numbers.
2. Athlete opens `/athlete/insights` → same cards, no Evidence button.
3. Viewport entry marks unread insights as read. Re-entry doesn't re-fire.
4. Dismissing removes from default list; "Show dismissed" toggle brings it back.
5. First-time `(category, metric)` slot fires one `INSIGHT_NEW` notification per recipient (athlete + coach if linked + not self-coached). Batch count reflected in title.
6. Subsequent recomputes into the same slot are silent.
7. Self-coached athlete's new-slot insight fires only the athlete notification.
8. `npx tsc --noEmit`, `npm run lint`, all new tests pass. Existing passing-test count maintained. Pre-existing sidebar-resolution failure remains the only failure.
9. Empty-state copy renders when athlete has thin data — no crashes, clear messaging.
10. Recompute button respects the existing 60s rate limit from sub-project B.

---

## Risks + Open Items for Implementation

- **Coach athlete detail tab integration** — grep the existing `/coach/athletes/[id]/page.tsx` for the tab pattern before adding the Insights entry point. Follow the same style.
- **Athlete notification preferences** — unclear if `AthleteProfile.notificationPreferences` parallels `CoachProfile`'s. Check with `grep -rn "isAthleteNotificationEnabled\|athleteNotificationPreferences" src/lib/`. If parallel exists, integrate the same way. If not, athletes always receive `INSIGHT_NEW` for MVP.
- **`IntersectionObserver` in SSR** — `onMarkRead` behavior is client-only. Guard with `useEffect` + `typeof window !== "undefined"` check.
- **Persist prior-slot lookup cost** — for 500+ historical insights, the `findMany` scans the `(athleteId, computedAt)` index. Fast at MVP scale. Revisit if volumes reach 10k+ per athlete.
- **Dismiss as shared field** — per-role dismiss columns are C-CONFIG territory. Flagged for follow-up.

---

## Scope Guardrails (Stop and Ask)

If any of these come up during implementation:

- Coach-per-athlete visibility customization → C-CONFIG
- Per-role dismiss distinct state → C-CONFIG
- Band-transition / effect-size threshold notifications → C-CONFIG
- Weekly / scheduled digest cron → C-DIGEST
- Roster-aggregate view → C-DIGEST
- Email / SMS / push for `INSIGHT_NEW` → platform-level, out of scope
- LLM-generated detail prose → C-LLM
- Dashboard widget embed → defer
- Insight sharing / export → out of scope
- Modifications to sub-project B analyzer files → only `persist.ts` and `types.ts` change, both additively
