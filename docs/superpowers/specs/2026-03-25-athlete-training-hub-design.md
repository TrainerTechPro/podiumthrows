# Athlete Training Hub — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Replaces:** `/athlete/sessions` (flat session list)

## Problem

The athlete's training page is a flat list of sessions. When no sessions are programmed, the athlete sees "No completed sessions yet" — a dead end. Athletes with coaches have no way to request programming, and the page provides zero value between sessions.

## Solution

Reimagine `/athlete/sessions` into a **context-aware Training Hub** that answers "what do I do today?" The page renders one of 3 states based on the athlete's programming situation, and always provides actionable next steps.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New page vs. reimagine existing | Reimagine `/athlete/sessions` | Athletes already have 15+ nav items — no new page |
| Empty state approach | Progressive (action cards now, smart recs later) | Ships fast, architecture supports phase 2 intelligence |
| Layout when active | Today-First (workout-centric) | Athletes execute, coaches plan — "what do I do now?" |
| Coach notification depth | Context-rich (data attached, no template suggestions) | Gives coach info without overstepping their judgment |
| Between-sessions experience | Completion summary + countdown | Celebrates effort, eliminates "did coach forget me?" anxiety |
| Coach action target | Existing Programming page, pre-filtered | No new coach-side pages needed |

## Nav Change

Rename sidebar item "My Sessions" to **"Training"** at `/athlete/sessions` (same route, new label).

## State 1: Active Training

**Condition:** Athlete has today's sessions OR upcoming sessions within 7 days.

### Section: Today's Training (hero)

- Prominently displays today's session(s) with exercise timeline, implement weights, throw counts
- Big "Start Workout" amber button per session
- Multiple sessions: tabbed view (Throws / Strength / Mixed)
- Reuses existing `TodaySession` data type and timeline rendering patterns from `_widgets/today-workout.tsx`
- If no session today but upcoming sessions exist: show next session card with countdown ("Next session: Thursday — Shot Put Heavy Implements")

### Section: Week Strip

- Compact Mon-Sun horizontal bar
- Each day: abbreviated day name, dot color-coded by session type (amber = throws, blue = strength, no dot = rest)
- Current day highlighted with amber background
- Tapping a future day shows a preview card of that day's session(s) below the strip

### Section: Quick Actions

- Horizontal pill buttons: "Log Session", "Readiness Check-in", "Drill Videos"
- Contextual visibility:
  - Hide "Check-in" if already completed today
  - Show pending questionnaire count if any exist
- Links to existing pages (`/athlete/log-session`, `/athlete/wellness`, `/athlete/drill-videos`)

### Section: Recent Completions (collapsible)

- Last 5 completed sessions
- Shows: date, session name, RPE, throw count, completion status badge
- Each row links to full session detail
- Default collapsed on mobile, expanded on desktop

## State 2: Between Sessions

**Condition:** Has completed sessions in the past, but no upcoming sessions within 7 days.

### Section: Week Recap Card

- "You completed X/Y sessions this week" (or "last week" if it's Monday)
- Mini stat row: total throws, average RPE, PRs hit (if any)
- Celebratory tone — amber/gold accents

### Section: Next Session Countdown (conditional)

- **If next session exists within 14 days:** "Next session: [Day], [Date] — [Session Name]" with day countdown
- **If no upcoming session within 14 days:** Transition to Request Programming card (below)

### Section: Request Programming Card

- Amber-bordered card: "Your coach hasn't scheduled your next sessions yet"
- **"Request Programming" button** — triggers `PROGRAMMING_REQUESTED` notification to coach
- **Cooldown:** Button disables for 48 hours after sending. Shows "Requested on [date]" status text
- **Duplicate prevention:** Only one active `PROGRAMMING_REQUESTED` notification per athlete. New request replaces old one.

### Section: Action Cards

Same quick actions as State 1 (Log Session, Check-in, Drill Videos, Questionnaires, Goals).

## State 3: Cold Start

**Condition:** No sessions ever (brand-new athlete).

### Section: Coach Connection

- "You're connected to Coach [Name]" with coach avatar
- Reassurance copy for new athletes

### Section: Request Programming Card

- Same component as State 2 but with onboarding copy: "Let your coach know you're ready to start training"
- Same notification mechanics and cooldown

### Section: Get Started Checklist

Prioritized for data-building (helps coach program correctly):

1. "Complete your Readiness Check-in" → `/athlete/wellness`
2. "Take the Bondarchuk Typing Quiz" → `/athlete/throws/quiz`
3. "Set your Goals" → `/athlete/goals`
4. "Fill out Questionnaires" → `/athlete/questionnaires` (if any pending)
5. "Log a Session" → `/athlete/log-session`
6. "Browse Drill Videos" → `/athlete/drill-videos`

Each card shows completion state (checkmark if done, amber highlight if actionable).

### Section: Progress Indicator

- "Profile completion: X/6" progress bar
- Fills as athlete completes onboarding actions
- Disappears once all are done or after 30 days (whichever comes first)

## Coach Notification: PROGRAMMING_REQUESTED

### New Notification Type

Add `PROGRAMMING_REQUESTED` to `NotificationType` in `src/lib/notifications.ts`.

### Notification Shape

```typescript
{
  type: "PROGRAMMING_REQUESTED",
  title: "[Athlete Name] is requesting programming",
  body: "Last session 5 days ago | Readiness 7.8 | Shot Put PR 18.42m",
  coachId: string,
  athleteId: string,
  metadata: {
    lastSessionDate: string | null,
    daysSinceLastSession: number | null,
    readinessScore: number | null,
    recentPRs: Array<{ event: string, distance: number, implement: string }>,
    goals: Array<{ title: string, progress: number }>,
    bondarchukType: string | null,
    events: string[],
  }
}
```

### Coach UX

- Notification links to `/coach/programming?athlete=[athleteProfileId]`
- Existing Programming page pre-filters to that athlete's calendar view
- No new coach-side pages required

## Dashboard Widget Update

Update `TodayWorkoutWidget` empty state (`RestDayState` component):

- **Current:** "Rest Day" with coffee icon
- **New (no sessions at all):** "No sessions scheduled" + "Go to Training ->" link
- **New (between sessions):** "Next: [Day] — [Session Name]" countdown

## API Changes

### New Endpoint: `POST /api/athlete/request-programming`

- Authenticated as athlete
- Looks up athlete's coach via `athleteProfile.coachId`
- Gathers context data (last session, readiness, PRs, goals, typing)
- Creates/replaces `PROGRAMMING_REQUESTED` notification for the coach
- Returns `{ success: true, cooldownUntil: ISO string }`
- Rejects if within 48-hour cooldown

### New Endpoint: `GET /api/athlete/training-hub`

- Returns the computed state for the Training Hub:
  - `state: "active" | "between" | "cold-start"`
  - `todaySessions: TodaySession[]`
  - `weekSessions: { date: string, sessions: SessionPreview[] }[]`
  - `weekRecap: { completed: number, total: number, throws: number, avgRpe: number, prs: PRItem[] } | null`
  - `nextSession: { date: string, name: string, daysUntil: number } | null`
  - `lastProgrammingRequest: { date: string } | null`
  - `onboardingProgress: { completed: string[], total: number } | null`
  - `coachName: string`
  - `coachAvatarUrl: string | null`

## Data Dependencies

All data already exists in the database. No schema changes needed except:
- Adding `PROGRAMMING_REQUESTED` to the notification type handling in `src/lib/notifications.ts`

Data sources:
- Today/upcoming sessions: `ProgrammedSession`, `ThrowsAssignment`, `ProgramSession` (existing queries in `src/lib/data/dashboard.ts`)
- Week recap stats: `SessionLog`, `ThrowsBlockLog` aggregate queries
- Readiness: `ReadinessCheckIn` (latest)
- PRs: `PersonalBest` model
- Goals: `Goal` model
- Bondarchuk typing: `ThrowsProfile.primaryType`
- Coach info: `AthleteProfile.coach` relation
- Onboarding checklist: check existence of ReadinessCheckIn, ThrowsProfile, Goal records

## Files to Create/Modify

### Create
- `src/app/(dashboard)/athlete/sessions/_training-hub.tsx` — main client component with state switching
- `src/app/(dashboard)/athlete/sessions/_week-strip.tsx` — compact week bar component
- `src/app/(dashboard)/athlete/sessions/_request-programming.tsx` — request button + cooldown logic
- `src/app/(dashboard)/athlete/sessions/_week-recap.tsx` — completion summary card
- `src/app/(dashboard)/athlete/sessions/_onboarding-checklist.tsx` — cold start action cards
- `src/app/api/athlete/request-programming/route.ts` — POST endpoint
- `src/app/api/athlete/training-hub/route.ts` — GET endpoint for hub data
- `src/lib/data/training-hub.ts` — data fetching functions

### Modify
- `src/app/(dashboard)/athlete/sessions/page.tsx` — replace flat list with Training Hub
- `src/components/ui/Sidebar.tsx` — rename "My Sessions" to "Training"
- `src/lib/notifications.ts` — add `PROGRAMMING_REQUESTED` type + creator function
- `src/app/(dashboard)/athlete/dashboard/_widgets/today-workout.tsx` — update `RestDayState` empty state

## Phase 2 (Not in Scope)

- Smart recommendations engine ("You haven't thrown discus in 12 days")
- Template suggestions in coach notifications
- AI-powered session generation from athlete context
- "Athlete Needs" detail page on coach side
- Week strip day-tap session preview (if too complex for v1, show as static dots only)
