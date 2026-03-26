# Coach Analytics Dashboard — Design Spec

**Date:** 2026-03-26
**Scope:** Add an analytics section to the coach dashboard with team performance metrics: distance improvement, compliance rate, readiness average, weekly volume chart, and season gains leaderboard.

---

## Problem Statement

The coach dashboard (`src/app/(dashboard)/coach/dashboard/page.tsx`) has a rich activity feed, readiness widget, PR board, and load overview — but no aggregated analytics. Coaches need to see at a glance whether their team is improving, training consistently, and recovering well. The current stat bar shows raw counts (athletes, sessions today, throws this week) but not the performance deltas and trends that drive coaching decisions.

## Goals

1. Team avg distance delta widget showing % improvement over a configurable period (30/60/90 days)
2. Compliance rate gauge: sessions completed / sessions assigned, as a prominent percentage
3. Average readiness score with trend arrow
4. Weekly volume bar chart: 7 bars showing total throws per day for the current week
5. Season gains leaderboard: top 5 athletes ranked by distance improvement (absolute meters)
6. All analytics in a dedicated "Analytics" section on the dashboard, below the existing Team Pulse zone

## Out of Scope

- Individual athlete analytics (lives on athlete detail page)
- Historical comparison (e.g., this month vs. last month)
- Export to CSV/PDF
- Custom date range picker beyond the 30/60/90 day selector
- Changes to existing dashboard sections (activity feed, readiness widget, etc.)

## Constraints

- The coach dashboard is a server component — analytics data must be fetched server-side
- Existing `CoachStats` type already has `complianceRate`, `throwsThisWeek`, `prsThisWeek`
- New aggregation queries needed for: distance deltas, weekly volume breakdown, season gains
- Must not add significant load to dashboard page — use `Promise.allSettled` pattern matching existing code
- No charting libraries — build the bar chart with CSS (Tailwind flex + height percentages)

---

## Visual Design

### Analytics Section Header

```
═══ ANALYTICS ═══
[30d]  [60d]  [90d]                                   Updated just now
```

- Section divider matching the existing "ZONE 2: TEAM PULSE" pattern
- Period selector: three small pill buttons, client-side (stores in cookie like `dashboard-mode`)
- Timestamp: muted, relative time

### Stat Cards Row

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Distance Δ  │  │  Compliance  │  │  Avg Ready.  │
│   +3.2%  ↑   │  │    87%       │  │    7.4 / 10  │
│  team avg    │  │  sessions    │  │  ↑ 0.3       │
└──────────────┘  └──────────────┘  └──────────────┘
```

- Three `StatCard` components in a `StaggeredList` grid
- Distance delta: `text-emerald-500` if positive, `text-red-500` if negative, `AnimatedNumber` with 1 decimal
- Compliance: `AnimatedNumber`, color by tier (emerald >= 80%, amber >= 60%, red < 60%)
- Avg readiness: `AnimatedNumber` with 1 decimal, same color tiers as readiness widget

### Weekly Volume Bar Chart

```
WEEKLY VOLUME (throws)
 Mon  Tue  Wed  Thu  Fri  Sat  Sun
  ██   ██                 ██
  ██   ██   ██        ██  ██
  ██   ██   ██   ██   ██  ██
  45   62   38   22   48  55   0
```

- 7 vertical bars, each bar height proportional to max day's throws
- Bar color: `bg-primary-500` with `dark:bg-primary-400`
- Day labels below: `text-[10px] text-muted uppercase`
- Throw counts below bars: `text-xs tabular-nums font-medium`
- Current day bar has a subtle glow: `ring-2 ring-primary-500/30`
- Bar container: `card` class, 200px max height
- Bars are pure CSS: `flex items-end gap-2`, each bar `min-w-[28px]` with dynamic `height` style

### Season Gains Leaderboard

```
TOP PERFORMERS (season)
─────────────────────────────────────
1  ★  Jake Thompson    +1.82m  SP
2     Maria Santos     +1.45m  DT
3     Chris Park       +1.23m  HT
4     Aisha Johnson    +0.98m  SP
5     Tom Williams     +0.87m  JT
```

- Numbered list, `StaggeredList` for entry animation
- Gold star icon (`Award` from Lucide, `text-amber-500`) on #1 position
- Each row: `Avatar` + name + distance delta (emerald, `tabular-nums`) + event badge
- Each row is a `Link` to `/coach/athletes/{id}` with hover state
- Empty state: "No distance data yet" if no throws logged in the period

---

## Data Flow

1. Coach dashboard server component loads (existing flow)
2. New data functions added to fetch analytics:
   - `getTeamDistanceDelta(coachId, days)` — avg best-throw improvement across athletes
   - `getWeeklyVolumeBreakdown(coachId)` — throws per day for current week
   - `getSeasonGains(coachId, days, limit)` — top athletes by distance improvement
3. Fetched in parallel with existing data via `Promise.allSettled`
4. Period preference stored in cookie (`dashboard-analytics-period`), defaults to 30
5. Period toggle is a client component that sets the cookie and triggers `router.refresh()`

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `src/app/(dashboard)/coach/dashboard/page.tsx` | Modify | Add analytics section below existing zones, fetch new data |
| `src/app/(dashboard)/coach/dashboard/_analytics-section.tsx` | Create | Client wrapper for period selector + stat cards + chart |
| `src/app/(dashboard)/coach/dashboard/_volume-chart.tsx` | Create | CSS bar chart component (no chart library) |
| `src/app/(dashboard)/coach/dashboard/_season-gains.tsx` | Create | Leaderboard component |
| `src/lib/data/dashboard-intel.ts` | Modify | Add `getTeamDistanceDelta`, `getWeeklyVolumeBreakdown`, `getSeasonGains` |

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes
- Analytics section renders below existing dashboard content
- Distance delta, compliance, and readiness stat cards show `AnimatedNumber` values
- Weekly volume chart renders 7 bars with correct proportional heights
- Current day bar has visual distinction (glow ring)
- Season gains leaderboard shows top 5 athletes sorted by improvement
- Period selector (30/60/90d) updates all analytics widgets
- Graceful handling when no data exists (empty states, not broken UI)
- Dashboard page load time does not regress significantly (new queries are parallel)
- No new dependencies introduced — bar chart is pure CSS
