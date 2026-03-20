# Coach Dashboard Reimagine — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Goal:** Transform the coach dashboard from a passive activity feed into a triage-first command center with actionable coaching suggestions, mode switching, and urgency-weighted layout.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Primary purpose | Triage cockpit — "who needs my attention right now?" | Coach's #1 need on login |
| Bondarchuk depth | Toggle: Standard / Advanced | Don't overwhelm new coaches; give veterans the depth |
| Context modes | Segmented control: Training Block / Competition Prep | Different phases need different data prominence |
| Activity feed | Keep but filter to notable events only | PRs, red flags, missed sessions — not routine completions |
| Layout pattern | Urgency-weighted stack (big top, dense bottom) | Most urgent stuff in 2 seconds; scroll for depth |
| Coaching suggestions | Per-athlete action cards with plain-language recommendations | User's top request — "what should I change for each athlete" |

---

## Layout: Three Zones

### Zone 1 — TRIAGE (top of page, big and loud)

#### 1a. Alert Bar (existing, unchanged)
Persistent red banner when athletes have active injuries. Links to athlete profile or roster page.

#### 1b. Coaching Action Cards (NEW — replaces "Needs Attention" horizontal scroll)

Full-width section. 2-column grid on desktop (lg:grid-cols-2), single column on mobile. Each card represents one athlete who needs a coaching decision, with a **specific plain-language suggestion**.

**Card types and data sources:**

| Type | Example text | Source | Priority |
|---|---|---|---|
| `injury_active` | "Emma — R shoulder, 3 days. No throwing cleared." | See injury resolution below | 1 (highest) |
| `acwr_high` | "Jake — ACWR 1.45, monotony high. Reduce volume." | `RiskAssessment` (ACWR > 1.3) | 2 |
| `complex_rotation` | "Sarah — 14 sessions in Complex 2, marks plateau. Rotate?" | `AdaptationCheckpoint` (recommendation = ROTATE_COMPLEX) | 3 |
| `sports_form_entered` | "Aisha entered sports form — shift to realization phase" | `ThrowsComplex` where `enteredSportsForm = true` (recent) | 3 |
| `low_readiness_pattern` | "Marcus — readiness below 5 for 3 consecutive days" | `ReadinessCheckIn` (3+ consecutive days < 5.0) | 4 |
| `missed_sessions` | "Tyler — skipped 3 of last 5 assigned sessions" | `ThrowsAssignment` (status = SKIPPED, threshold: 3+ of last 5) | 4 |
| `deload_recommended` | "Jake — high monotony + declining marks. Deload week?" | `AutoregulationSuggestion` (status = PENDING) | 4 |
| `goal_at_risk` | "Dylan — PR goal deadline in 14 days, 92% of target" | `Goal` (see goal resolution below) | 5 |
| `no_checkin` | "Liam — no readiness check-in for 5 days" | `ReadinessCheckIn` (last > 5 days ago) | 6 |

**Injury resolution:** Three sources signal "active injury" — query all, deduplicate per athlete:
1. `ThrowsInjury` where `returnToThrowDate` is null or in the future (throws-specific injuries with `throwsBanned`/`heavyBanned` flags)
2. `Injury` where `recovered = false` (general injuries)
3. `ReadinessCheckIn` where `injuryStatus = "ACTIVE"` and date is within last 7 days (self-reported)
Priority: if any source signals active, the athlete is flagged. Summary text prefers `ThrowsInjury` details (body part, side) when available, falls back to `Injury`, then `ReadinessCheckIn`.

**Goal-at-risk resolution:** Use the `Goal` model (not `AthleteGoal`). `Goal` has `targetValue`, `currentValue`, `unit`, and `deadline` (DateTime). Filter: `deadline` within 21 days AND `(currentValue / targetValue) * 100 < 95`. The `AthleteGoal` model (SMART framework with `timeBound` String and manual `progress` Int) is a separate system — skip it for dashboard actions to avoid conflating the two.

**AdaptationCheckpoint join path:** `AdaptationCheckpoint` has no direct `athleteId`. Join through: `AdaptationCheckpoint.programId -> TrainingProgram.id` where `TrainingProgram.coachId = coachId` and `TrainingProgram.athleteId IS NOT NULL`. Extract `athleteId` from `TrainingProgram`.

**Card anatomy:**
- Left: Avatar (size="sm")
- Center: athlete name (font-medium), suggestion text (text-sm text-muted), severity badge
- Right: link arrow to athlete detail page
- Left border color: red (injury/ACWR), amber (rotation/readiness/missed), blue (sports form/goals), gray (no check-in)

**Display rules:**
- Sorted by priority (lowest number = highest priority)
- Max 6 cards shown; "View all X items" link if more
- When zero items: green "All clear — no actions needed" banner (similar to current "All athletes healthy")

**Advanced mode additions per card:**
- Adaptation phase label badge (e.g., "Transmutation")
- ACWR value when available
- Deficit classification badge — derived from `ThrowsProfile` fields: if `muscledOut = true` -> "Muscled Out", else if `overPowered = true` -> "Over-powered", else use `deficitStatus` field (e.g., "Under-powered", "Balanced"). Falls back to null if no `ThrowsProfile` exists.

#### Data: New function `getCoachingActions(coachId): CoachingAction[]`

```typescript
interface CoachingAction {
  id: string;
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  type: "injury_active" | "acwr_high" | "complex_rotation" | "sports_form_entered"
      | "low_readiness_pattern" | "missed_sessions" | "deload_recommended"
      | "goal_at_risk" | "no_checkin";
  priority: number;       // 1-6, lower = more urgent
  summary: string;        // Plain-language suggestion
  severity: "critical" | "warning" | "info";
  meta?: Record<string, unknown>; // Extra data for advanced mode (ACWR value, phase, deficit)
}
```

This function queries across multiple tables using `Promise.allSettled`:
1. Active injuries — union of `ThrowsInjury`, `Injury`, and recent `ReadinessCheckIn` (see injury resolution above)
2. ACWR risk from `RiskAssessment` (latest per athlete, where ACWR > 1.3)
3. Adaptation checkpoints from `AdaptationCheckpoint` via `TrainingProgram` join (recommendation != CONTINUE, applied = false)
4. Readiness patterns from `ReadinessCheckIn` (3+ consecutive < 5.0)
5. Assignment compliance from `ThrowsAssignment` (skipped ratio in last 5)
6. Pending autoregulation from `AutoregulationSuggestion` (status = PENDING)
7. At-risk goals from `Goal` (deadline within 21 days, currentValue/targetValue < 95%)
8. Stale check-ins from `ReadinessCheckIn` (last > 5 days ago)

Merges, deduplicates (one entry per athlete, highest priority wins), sorts by priority, returns array.

---

### Zone 2 — TEAM PULSE (middle, medium density)

#### 2a. Stat Bar (existing, enhanced)

**Keep:** total athletes, sessions today, 30-day compliance, injured count, low readiness count.

**Add:**
- "X throws this week" — 7-day rolling throw count across team (from `ThrowsBlockLog`, `PracticeAttempt`, `AthleteDrillLog`)
- "X PRs this week" — count of PRs set in last 7 days (from `ThrowsPR`, `ThrowsDrillPR`)

#### Data: Enhanced `getCoachStats()` to include `throwsThisWeek: number` and `prsThisWeek: number`.

**Note on date fields:** `ThrowsPR.achievedAt` and `ThrowsDrillPR.achievedAt` are `String` (YYYY-MM-DD format), not `DateTime`. Use string comparison (`>= todayMinus7`) for filtering. Same applies to `ThrowsCompetition.date`.

---

#### 2b. Competition Countdown (NEW — Competition Prep mode only)

Horizontal row of compact cards for upcoming A and B priority competitions within the next 60 days.

**Card anatomy:**
- Competition name + event
- "X days" large number
- Priority badge (A = primary, B = neutral)
- Athletes competing (avatar stack, max 4 + "+N")
- Taper status indicator (if within 21 days: "Taper Week 1/2/3")

**Taper week calculation:** Simple division: `taperWeek = Math.ceil((21 - daysOut) / 7)` clamped to 1-3. This is separate from `generateTaperPlan()` in profile-utils.ts which computes fine-grained volume multipliers — the countdown card only needs the week number.

**Data source:** `ThrowsCompetition` where `date >= todayISO` and `date <= todayPlus60ISO` (string comparison, YYYY-MM-DD) and `priority IN ("A", "B")`. Scoped to coach via join: `ThrowsCompetition.athleteId -> AthleteProfile.id WHERE AthleteProfile.coachId = coachId`.

#### Data: New function `getUpcomingCompetitions(coachId): UpcomingCompetition[]`

```typescript
interface UpcomingCompetition {
  id: string;
  name: string;
  event: string;
  date: string;            // YYYY-MM-DD string from schema
  daysOut: number;
  priority: "A" | "B";
  athletes: { id: string; name: string; avatarUrl: string | null }[];
  taperWeek: number | null; // 1-3 if within 21 days, null otherwise
}
```

---

#### 2c + 2d. Two-Column: Smart Activity Feed + Team Readiness

**Left column (lg:col-span-3): Smart Activity Feed (existing, filtered)**

Enhanced `getRecentActivity()` with `notableOnly` parameter. When `true`, only includes:
- Personal bests (PRs) — existing query on `ThrowLog` where `isPR = true` + `ThrowsPR` created in last 48h
- Injury status changes — new `ReadinessCheckIn` where `injuryStatus` changed from previous check-in
- Streak breaks — `AthleteProfile` where `currentStreak` dropped to 0 (compare with previous day's value, or check `ReadinessCheckIn` gap > streak threshold)
- Missed/skipped sessions — `ThrowsAssignment` where `status = "SKIPPED"` in last 48h
- Sports form entered — `ThrowsComplex` where `enteredSportsForm = true` and `updatedAt` in last 48h (scoped to coach via `ThrowsComplex.athleteId -> AthleteProfile.coachId`)
- Readiness red flags (score < 4.0) — existing query on `ReadinessCheckIn`, just filter by score
- New autoregulation suggestion — `AutoregulationSuggestion` where `status = "PENDING"` and `createdAt` in last 48h

New `ActivityItem.type` additions needed: `"streak_break"`, `"injury_change"`, `"sports_form"`, `"missed_session"`, `"autoregulation"`. Add corresponding `ActivityIcon` and `ActivityDescription` cases.

Excludes: routine session completions (RPE-only logs), normal readiness check-ins (score >= 5).

**Right column (lg:col-span-2): Team Readiness (existing, unchanged)**

Keep current implementation — avatar, name, progress bar, score, trend icon. It's clean and functional.

---

### Zone 3 — INTEL (bottom, dense, scroll to reach)

#### 3a. PR Board (NEW)

Recent team PRs from the last 14 days. Compact table or card row with gold/amber accent.

**Desktop columns:** Athlete name + avatar, event, implement weight, distance (bold, tabular-nums), date, "Training"/"Competition" badge.

**Mobile:** Stack as cards (avatar + name top, event/implement/distance below, date + source badge right-aligned). No horizontal scroll table on mobile.

**Data source:** `ThrowsPR` + `ThrowsDrillPR` where `achievedAt >= todayMinus14ISO` (string comparison, YYYY-MM-DD format), sorted by `achievedAt` desc. Scoped to coach via `athleteId -> AthleteProfile.coachId`.

#### Data: New function `getRecentTeamPRs(coachId, days = 14): TeamPR[]`

```typescript
interface TeamPR {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  event: string;
  implement: string;       // e.g., "7.26kg"
  distance: number;        // meters
  date: string;            // YYYY-MM-DD string
  source: "TRAINING" | "COMPETITION";
}
```

Max 10 shown. Link to full throws hub for more.

---

#### 3b. Training Load Overview (NEW)

Compact per-athlete rows showing load at a glance. All roster athletes, sorted by risk (red first).

**Desktop columns:** Avatar + name, 7-day throw volume (number), ACWR ratio (colored: green < 1.0, amber 1.0-1.3, red > 1.3), risk label.

**Mobile:** Each athlete as a compact card. Name + avatar top row, then a row of stat pills: "47 throws", "ACWR 1.12", risk badge. Stacks vertically.

**Advanced mode adds columns (hidden on mobile):**
- Adaptation phase (loading / adapting / in-form / readaptation-risk)
- Deficit classification — derived from `ThrowsProfile`: `muscledOut = true` -> "Muscled Out", `overPowered = true` -> "Over-powered", else `deficitStatus` value, else null
- Sessions to form estimate (from `ThrowsTyping.sessionsToForm` or `TrainingProgram.sessionsToForm`)

**Data source:** `RiskAssessment` (latest per athlete) + throw volume from `ThrowsBlockLog`/`PracticeAttempt`/`AthleteDrillLog` (7-day count) + `AdaptationCheckpoint` via `TrainingProgram` join (latest per athlete) + `ThrowsProfile` (deficit fields).

#### Data: New function `getTeamLoadOverview(coachId): TeamLoadEntry[]`

```typescript
interface TeamLoadEntry {
  athleteId: string;
  athleteName: string;
  avatarUrl: string | null;
  throwsThisWeek: number;
  acwr: number | null;
  riskLevel: "low" | "moderate" | "high" | null;
  // Advanced mode fields
  adaptationPhase: "loading" | "adapting" | "in-form" | "readaptation-risk" | null;
  deficitClassification: string | null;  // Derived from ThrowsProfile (see above)
  sessionsToForm: number | null;
}
```

---

#### 3c. Context-Dependent Section

**Training Block mode + Advanced: Adaptation Progress (NEW)**

Per-athlete compact rows:
- Current complex name/number
- Sessions in complex (e.g., "8 / 14")
- Mark trend arrow (up/down/flat based on `AdaptationCheckpoint.markSlope` — positive = up, negative = down, near-zero = flat; threshold: abs(slope) < 0.05 = flat)
- Phase label badge (color-coded)

**Mobile:** Cards with complex name as header, stats as pills below.

Data from `AdaptationCheckpoint` (via `TrainingProgram` join) + `ThrowsComplex`.

**Competition Prep mode: Peaking Status (NEW)**

Per-athlete compact rows:
- Target competition name + days out
- Taper week (1/2/3) — same calculation as 2b: `Math.ceil((21 - daysOut) / 7)` clamped 1-3
- Volume reduction % (from `generateTaperPlan(daysOut).volumeMultiplier`, displayed as `(1 - multiplier) * 100`)
- Current readiness score
- Last 7d readiness trend (up/down/stable from `getTeamReadinessTrends`)

**Mobile:** Cards per athlete with competition name header, stat pills for taper/volume/readiness.

Data from `ThrowsCompetition` (string date comparison) + `ReadinessCheckIn` + `generateTaperPlan()` from `src/lib/throws/profile-utils.ts`.

---

## Top Controls

### Mode Selector

Segmented control in the page header area, right-aligned next to the greeting.

```
[ Training Block | Competition Prep ]
```

- Persisted via cookie (`dashboard-mode`) — survives sessions
- Default: `Training Block`
- Client component: `DashboardModeSelector`
- Passed as prop to server components via searchParam or cookie read

### Bondarchuk Depth Toggle

Small toggle below the mode selector or inline with it.

```
Standard | Advanced
```

- Persisted via cookie (`dashboard-depth`)
- Default: `Standard`
- When Advanced: extra columns/badges appear on action cards, load overview, and context section
- Client component: `DashboardDepthToggle`

---

## Loading States

Each zone uses the existing `shimmer` skeleton pattern from the design system.

- **Zone 1 (Action Cards):** 4 skeleton cards in 2-col grid (shimmer rectangles matching card anatomy)
- **Zone 2 (Stat Bar):** Shimmer spans matching stat text widths
- **Zone 2 (Activity Feed + Readiness):** Existing skeleton patterns from current dashboard
- **Zone 3 (PR Board, Load Overview, Context):** `SkeletonTableRow` (existing component) with appropriate column counts

Implementation: Wrap each zone in `<Suspense>` with skeleton fallback. Since data fetching uses `Promise.allSettled` in a single server component, all zones render together. If we want independent streaming, split into separate async server components per zone and wrap each in its own `<Suspense>`. Recommendation: keep the single `Promise.allSettled` approach for simplicity — the queries are fast and the page is not latency-sensitive enough to warrant per-zone streaming.

---

## Removed / Demoted

| Current element | Disposition |
|---|---|
| "Needs Attention" horizontal scroll cards | **Replaced** by Coaching Action Cards (Zone 1b) |
| Recent Athlete Logs section | **Absorbed** into Smart Activity Feed (notable self-logged sessions appear as feed items) |
| "All athletes healthy" green banner | **Replaced** by absence of action cards + small green "All clear" inline message |
| Onboarding Checklist | **Unchanged** — still shows for new coaches |
| Upgrade Banner | **Unchanged** — still shows for free plan near limit |
| First Visit Hints | **Unchanged** — still shows for first visit |

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/data/coaching-actions.ts` | `getCoachingActions()` — synthesizes multi-source coaching suggestions |
| `src/lib/data/dashboard-intel.ts` | `getRecentTeamPRs()`, `getTeamLoadOverview()`, `getUpcomingCompetitions()` |
| `src/app/(dashboard)/coach/dashboard/_mode-selector.tsx` | Client component: mode + depth toggle |
| `src/app/(dashboard)/coach/dashboard/_action-cards.tsx` | Coaching Action Cards component |
| `src/app/(dashboard)/coach/dashboard/_pr-board.tsx` | PR Board component |
| `src/app/(dashboard)/coach/dashboard/_load-overview.tsx` | Training Load Overview component |
| `src/app/(dashboard)/coach/dashboard/_competition-countdown.tsx` | Competition Countdown component |
| `src/app/(dashboard)/coach/dashboard/_peaking-status.tsx` | Peaking Status component (Competition Prep mode) |
| `src/app/(dashboard)/coach/dashboard/_adaptation-progress.tsx` | Adaptation Progress component (Training Block + Advanced) |

## Modified Files

| File | Changes |
|---|---|
| `src/app/(dashboard)/coach/dashboard/page.tsx` | Rewrite layout to 3-zone urgency stack, add mode/depth logic, replace current sections |
| `src/lib/data/coach.ts` | Enhance `getCoachStats()` with `throwsThisWeek`/`prsThisWeek`, enhance `getRecentActivity()` with `notableOnly` filter and new activity types |

---

## Technical Notes

- All data fetching uses `Promise.allSettled` for resilience (existing pattern)
- Mode/depth stored in cookies, read server-side via `cookies()` from `next/headers`
- Mode selector and depth toggle are client components using `useRouter().refresh()` after cookie update to trigger server re-render
- No new dependencies — uses existing Lucide icons, Tailwind classes, custom components
- Competition Prep sections gracefully handle zero upcoming competitions (hidden, not empty state)
- Advanced mode sections gracefully handle missing data (null ACWR, no adaptation checkpoint) with "—" placeholders
- Date fields: `ThrowsPR.achievedAt`, `ThrowsDrillPR.achievedAt`, and `ThrowsCompetition.date` are `String` (YYYY-MM-DD), not `DateTime`. All date filtering must use string comparison (e.g., `gte: "2026-03-05"`) not DateTime objects
- `AdaptationCheckpoint` has no direct `athleteId` — always join through `programId -> TrainingProgram` where `TrainingProgram.coachId` matches and `TrainingProgram.athleteId IS NOT NULL`
- Adaptation mark trend uses `AdaptationCheckpoint.markSlope` field (not `linearSlope` utility function)
