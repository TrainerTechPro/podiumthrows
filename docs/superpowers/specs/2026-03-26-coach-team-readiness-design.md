# Coach Team Readiness Dashboard — Design Spec

**Date:** 2026-03-26
**Scope:** Replace the "Coming Soon" stub on the coach wellness page with a full team readiness dashboard showing per-athlete scores, trends, and threshold alerts.

---

## Problem Statement

The coach wellness page (`src/app/(dashboard)/coach/wellness/page.tsx`) is a static stub listing planned features. Meanwhile, `ReadinessCheckIn` data is already being collected (athletes submit daily check-ins with sleep, soreness, stress, energy, hydration, and injury status), and the coach dashboard already has a basic `ReadinessWidget` showing latest scores. Coaches need a dedicated page to monitor team wellness in depth — not just latest scores, but trends, breakdowns, and alerts.

## Goals

1. Team average readiness hero stat with trend indicator (up/down/stable vs. 7 days ago)
2. Per-athlete readiness bars sorted by score (lowest first so at-risk athletes surface immediately)
3. 7-day trend sparklines per athlete showing daily readiness trajectory
4. Category breakdown per athlete (sleep, soreness, stress, energy) on hover or tap
5. Threshold alert banner: athletes below 5.0 overall score get flagged in a red alert section
6. Filter by event group to narrow to shot putters, discus throwers, etc.

## Out of Scope

- WHOOP/Oura integration display (separate wearable dashboard spec exists)
- Editing or submitting check-ins from the coach side
- Push notifications for low readiness
- Historical readiness analytics beyond 7-day sparklines
- Changes to the ReadinessCheckIn schema

## Constraints

- Data source: `ReadinessCheckIn` model with fields: `overallScore`, `sleepQuality`, `sleepHours`, `soreness`, `stressLevel`, `energyMood`, `hydration`, `injuryStatus`
- Existing API: `/api/readiness/team` route exists at `src/app/api/readiness/team/route.ts`
- Existing data function: `getTeamReadinessTrends(coachId)` in `src/lib/data/coach.ts` already returns `TeamReadinessEntry[]` with `athleteId`, `athleteName`, `avatarUrl`, `latestScore`, `maxScore`, `trend`
- Need to extend the data function to include 7-day history and category breakdowns, or add a new function

---

## Visual Design

### Hero Stat Bar

```
┌──────────────────────────────────────────────────────────────┐
│  TEAM READINESS          7.2 avg  ↑ 0.4 from last week     │
│  [████████████████████████░░░░░░] 72%   12 athletes         │
└──────────────────────────────────────────────────────────────┘
```

- `AnimatedNumber` for the average score, 1 decimal
- `ProgressBar` showing team average as percentage of 10
- Color: emerald >= 7.0, amber >= 5.0, red < 5.0
- Trend delta: `TrendingUp`/`TrendingDown`/`Minus` icon from Lucide, colored

### Alert Banner (conditional)

Shown when any athlete has `overallScore < 5.0`:

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠ 2 athletes below readiness threshold                     │
│  Sarah Chen (3.8)  ·  Marcus Williams (4.2)    View All →   │
└──────────────────────────────────────────────────────────────┘
```

- `bg-red-500/10 border border-red-500/20`, `AlertTriangle` icon
- Athlete names as links to their profiles
- Only shown when there are flagged athletes

### Event Group Filter

```
[All Athletes]  [Shot Put]  [Discus]  [Hammer]  [Javelin]
```

- Pill-style filter tabs matching the exercise library pattern
- Filter uses `AthleteProfile.events` array membership
- Count badge per tab

### Athlete Readiness Grid

Each athlete as a row in a `StaggeredList`:

```
┌──────────────────────────────────────────────────────────────┐
│  [Avatar] Sarah Chen          ▁▂▃▅▇▆▅  3.8 / 10           │
│           Shot Put · Discus   [sleep 4] [sore 3] [stress 5] │
└──────────────────────────────────────────────────────────────┘
```

- `Avatar` component, `size="sm"`
- Name: `text-sm font-semibold`, events below in `text-xs text-muted`
- Sparkline: 7 tiny bars (one per day), height proportional to that day's score, colored by tier
- Score: large `tabular-nums font-bold`, color-coded (emerald/amber/red)
- Category badges: small pills showing the lowest-scoring categories, colored by value
- Entire row is a `Link` to `/coach/athletes/{id}` with `card card-interactive` class
- Sorted by `overallScore` ascending (worst first)

### Empty State

When no check-in data exists:

```
No readiness data yet.
Athletes can submit daily check-ins from their dashboard.
```

Centered, muted, with a link to the athlete onboarding guide.

---

## Data Flow

1. Server component calls `requireCoachSession()` to get coach
2. Fetches team readiness data via extended `getTeamReadinessTrends(coachId)` or new `getTeamReadinessDetail(coachId)` function
3. New function queries `ReadinessCheckIn` for last 7 days per athlete, includes category scores
4. Returns array of `{ athleteId, athleteName, avatarUrl, events, latestScore, maxScore, trend, history: { date, score }[], categories: { sleep, soreness, stress, energy } }`
5. Page renders server-side, sparklines computed from history array
6. Event group filter is client-side (filter the pre-fetched data)

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `src/app/(dashboard)/coach/wellness/page.tsx` | Rewrite | Replace stub with full readiness dashboard |
| `src/app/(dashboard)/coach/wellness/_readiness-grid.tsx` | Create | Client component for filterable athlete grid with sparklines |
| `src/lib/data/coach.ts` | Modify | Add `getTeamReadinessDetail()` function or extend existing |
| `src/app/api/readiness/team/route.ts` | Possibly modify | If client-side fetching is needed for filters |

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes
- "Coming Soon" stub is fully replaced with working readiness dashboard
- Team average hero stat animates on load via `AnimatedNumber`
- Athletes sorted by score ascending (lowest first)
- Alert banner appears when any athlete is below 5.0
- Event group filter correctly narrows the athlete list
- Sparklines render 7 bars per athlete, colored by tier
- Category breakdown badges show correct values
- Each athlete row links to their profile
- Empty state shown when no check-in data exists
- No new dependencies introduced
