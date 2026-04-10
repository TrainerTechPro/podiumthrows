# Athlete Dashboard Overhaul — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Author:** Claude + Anthony

---

## Overview

Redesign the athlete dashboard into a customizable, widget-based experience. Athletes choose from curated presets or toggle/reorder individual widgets. The dashboard leads with readiness (recovery-first philosophy aligned with Bondarchuk methodology), followed by today's workout preview.

**Goals:**
- Readiness-first: athletes check in before they train
- Today's Workout front-and-center with visual timeline preview
- Customizable layout via presets + per-widget toggle/reorder
- Framer-level animation polish — spring physics, staggered reveals, shaped skeletons
- Mobile-first design (athletes primarily use phones)

**Non-goals:**
- Drag-and-drop reorder (future upgrade)
- Widget resize / variable sizes (all full-width on mobile)
- Real-time data refresh (standard navigation)
- New database tables (JSON column only)

---

## Widget Catalog

10 available widgets. Each is a React Server Component that receives pre-fetched data as props and handles its own loading/empty states. The dashboard page orchestrates all data fetching centrally (see Data Fetching section).

| ID | Name | Description | Default Preset |
|---|---|---|---|
| `readiness` | Readiness Score | Hero widget — circular ring with score, factor breakdown, or check-in prompt. Always pinned first, cannot be removed. | All |
| `today-workout` | Today's Workout | Preview timeline of today's sessions. Session tabs when 2+ sessions exist. | All |
| `calendar` | Workout Calendar | Month grid with dot indicators for completed (green) and scheduled (gold) days. | Performance, Detailed, Recovery |
| `prs` | Personal Bests | Top 3-4 PRs across events with animated distances. | Performance, Detailed |
| `quick-stats` | Quick Stats | 3 compact stat boxes: Sessions This Week, Day Streak, Total Sessions. | Minimal, Performance, Detailed |
| `goals` | Goals Progress | Active goals with progress bars. | Detailed, Recovery |
| `volume` | Training Volume | Weekly throws/lifts volume chart. | Detailed |
| `upcoming-sessions` | Upcoming Sessions | Next 5 scheduled sessions list. | Detailed |
| `videos` | Recent Videos | Latest coaching videos. | — (opt-in only) |
| `questionnaires` | Pending Questionnaires | Unanswered coach questionnaires with count badge. | — (opt-in only) |

---

## Presets

| Preset | Widgets (in order) | Use Case |
|---|---|---|
| **Minimal** | readiness, today-workout, quick-stats | Quick glance — check in, see workout, done |
| **Performance** (default) | readiness, today-workout, calendar, prs, quick-stats | The sweet spot for active athletes |
| **Detailed** | readiness, today-workout, calendar, prs, quick-stats, goals, volume, upcoming-sessions | Everything at a glance |
| **Recovery** | readiness, today-workout, calendar, goals | Deload weeks or injury periods |

New athletes receive the **Performance** preset by default.

---

## Widget Details

### 1. ReadinessHeroWidget (pinned, always first)

**Checked-in state:**
- Circular ring with animated fill (spring physics: damping 20, stiffness 100, slight overshoot)
- Score displayed inside ring (large, bold, color-coded)
- Color scheme: green (8+), amber (5-7), red (<5)
- Gradient background shifts with score via CSS custom properties
- Factor breakdown grid (2x2): Sleep, Soreness, Stress, Energy — each with label, value/10, and animated bar
- Factor bars stagger in 50ms apart, 600ms width animation each
- Tappable → navigates to `/athlete/wellness` history
- "History >" link in widget header

**Not-checked-in state:**
- Gold-tinted card with subtle pulsing glow animation (CSS keyframes, 2s cycle)
- Text: "Check in to unlock today's readiness"
- CTA button with spring bounce on press
- Tappable → navigates to `/athlete/wellness` to submit check-in

### 2. TodayWorkoutWidget

**No sessions today:**
- Empty state: "No training scheduled today — enjoy your rest day" with rest icon

**Single session:**
- Session name + status badge ("Not Started" / "In Progress" / "Completed")
- Mini vertical timeline showing first 3-4 exercises:
  - Vertical line (2px, `#252530`)
  - Colored dots per type: throws (gold/amber), lifts (blue), warmup (orange), notes (gray)
  - Exercise name + detail (throws: "12 throws", lifts: "3 x 2")
  - Superset badges (A/B/C) — small colored circles floated right
  - "+ N more exercises" truncation link
- "Start Workout" button (gold, full-width, spring bounce)
- Tappable → full session detail page

**Multiple sessions (2+):**
- Tab bar at top using existing `<Tabs>` component with sliding underline indicator
- Each tab: icon + label + time (e.g., "Throws — 9:00 AM" / "Strength — 2:00 PM")
- Tab content: same mini timeline + start button per session
- Athletes can start any session independently, in any order
- Timeline items stagger in on tab switch (fade + slide-up, 40ms stagger)

**CRITICAL — Bondarchuk rules still apply:**
- Within a throws session, implements must display in descending weight order
- The tab order does NOT enforce session sequence — athletes choose which to do first
- Any implement weight sequencing violations are flagged in the full session detail, not the dashboard preview

### 3. WorkoutCalendarWidget

- Standard month grid (Sun-Sat) with left/right navigation arrows
- Month transition: crossfade animation
- Day indicators:
  - Completed session: green dot below date
  - Scheduled/planned session: gold dot below date
  - Today: filled amber ring around date number + dot if session exists
  - No session: plain date
- Tapping a day with a session navigates to that session's detail page
- Dots scale in with micro-spring on first render (300ms, staggered by row)

### 4. PersonalBestsWidget

- List of top 3-4 PRs with:
  - Gold medal icon (subtle shimmer on hover via CSS)
  - Event name (formatted: "Shot Put", "Discus", etc.)
  - Distance with `<AnimatedNumber>` (2 decimals)
  - Recency text ("2 days ago", "Last week")
- "History >" link → `/athlete/throws`
- Empty state: "No personal bests yet — log throws to see your marks here"

### 5. QuickStatsWidget

- 3 compact stat boxes in a row:
  - Sessions This Week (number)
  - Day Streak (number)
  - Total Sessions (number)
- All values use `<AnimatedNumber>` for count-up on viewport entry
- Compact: no header, just the stat boxes in a card

### 6-10. Remaining Widgets

Follow existing component patterns from the current dashboard:
- **GoalsWidget**: Active goals with progress bars, links to `/athlete/goals`
- **VolumeWidget**: Reuse existing `<VolumeWidget>` component
- **UpcomingSessionsWidget**: Reuse existing session list (top 5)
- **VideosWidget**: Recent 3 coaching videos with thumbnails
- **QuestionnairesWidget**: Count of pending questionnaires with link

---

## Customize Panel

**Access:** "Customize dashboard" link in dashboard header (gear icon + text)

**Implementation:** Full-screen modal sheet on mobile, slides up with spring animation (300ms) + backdrop blur (`backdrop-filter: blur(16px)`).

**Layout:**
1. **Preset selector** — 4 preset cards in a 2x2 grid. Active preset highlighted with gold border. Tapping a preset replaces the full widget config.
2. **Widget toggles** — List of all 10 widgets, each with:
   - Widget icon + name
   - On/off toggle switch
   - Up/down arrow buttons for reorder (readiness is locked at top, grayed arrows)
   - Disabled state for "readiness" toggle (always on, can't remove)
3. **Reset to default** button at bottom
4. Changes save immediately via optimistic update + PATCH API call

---

## Schema Changes

**Single column addition to `AthleteProfile`:**

```prisma
model AthleteProfile {
  // ... existing fields
  dashboardConfig  Json?  // null = "performance" preset defaults
}
```

**JSON shape:**

```typescript
type DashboardConfig = {
  preset: "minimal" | "performance" | "detailed" | "recovery" | "custom";
  widgets: string[];  // enabled widget IDs
  order: string[];    // display order (readiness always forced first)
};
```

When `dashboardConfig` is `null`, the dashboard renders the "performance" preset. First customization writes the full config. Selecting a preset overwrites the entire config with that preset's defaults.

**Migration:** `prisma migrate dev` to add the nullable JSON column. No data migration needed — null means default.

---

## Data Fetching

**Architecture: centralized fetch, dumb widget components.**

The dashboard `page.tsx` (Server Component) is the single data orchestrator. It reads the athlete's config, determines which widgets are enabled, fetches data for only those widgets in parallel via `Promise.all`, then passes data as props to each widget component. Widget components are pure render — they do NOT fetch their own data.

```typescript
// _widget-registry.ts — maps widget IDs to fetcher functions
const WIDGET_FETCHERS: Record<string, (athleteId: string) => Promise<unknown>> = {
  readiness: fetchReadinessData,
  "today-workout": fetchTodayWorkoutData,
  calendar: fetchCalendarData,
  prs: fetchPRsData,
  "quick-stats": fetchQuickStatsData,
  goals: fetchGoalsData,
  volume: fetchVolumeData,
  "upcoming-sessions": fetchUpcomingSessionsData,
  videos: fetchVideosData,
  questionnaires: fetchQuestionnairesData,
};

// page.tsx — orchestrates fetching + rendering
const config = athlete.dashboardConfig ?? PRESETS.performance;
const enabled = config.order.filter(w => config.widgets.includes(w));

// Parallel fetch for only enabled widgets
const entries = await Promise.all(
  enabled.map(async w => [w, await WIDGET_FETCHERS[w](athlete.id)] as const)
);
const dataMap = Object.fromEntries(entries);

// Render widgets in order, passing pre-fetched data as props
return enabled.map(w => <WidgetRenderer key={w} id={w} data={dataMap[w]} />);
```

Each widget component receives its data as a prop and is responsible only for rendering + loading/empty states. This avoids waterfall fetches and keeps widget components simple and testable.

**Today's Workout data query — exact models:**

Three sources of "today's sessions" must be queried and merged:

1. **`ProgramSession`** — Bondarchuk program sessions
   - `WHERE scheduledDate = today AND program.athleteId = athlete.id AND status IN ('PLANNED','SCHEDULED','IN_PROGRESS','COMPLETED')`
   - Exercises come from JSON fields: `throwsPrescription`, `strengthPrescription`, `warmupPrescription`
   - `sessionType` determines tab label: THROWS_ONLY → "Throws", THROWS_LIFT → "Throws + Lift", LIFT_ONLY → "Strength"

2. **`ThrowsAssignment`** — Coach-assigned throwing sessions
   - `WHERE assignedDate = today AND athleteId = athlete.id AND status IN ('ASSIGNED','NOTIFIED','IN_PROGRESS','COMPLETED')`
   - Exercises come from `session.blocks[]` (ThrowsBlock), each with `blockType` and `config` JSON
   - Always a throws session (tab label: "Throws")

3. **`AthleteThrowsSession`** — Athlete self-logged sessions
   - `WHERE date = today AND athleteId = athlete.id`
   - Exercises come from related `drillLogs[]` (AthleteDrillLog), each with drill name, implement, sets, throws
   - Tab label: "Self-Logged" or event name (e.g., "Shot Put")
   - These show as a session tab alongside coach-assigned sessions, but with a subtle "self-logged" indicator

4. **`TrainingSession`** — Legacy general sessions (if any remain)
   - `WHERE scheduledDate = today AND athleteId = athlete.id AND status IN ('SCHEDULED','IN_PROGRESS','COMPLETED')`
   - Exercises come from related `SessionLog[]`

**Normalized timeline item shape** for the preview (all sources transform into this):

```typescript
type TimelineItem = {
  id: string;
  name: string;           // "9kg Shot Put", "BB Clean", "Warm-Up"
  type: "throw" | "lift" | "warmup" | "note" | "cooldown";
  detail: string;         // "12 throws" for throws, "3 x 2" for lifts, description for warmup
  supersetGroup?: string; // "A", "B", "C" — only for lifts
  position: number;       // sort order within session
};

type TodaySession = {
  id: string;
  source: "program" | "assignment" | "legacy";
  name: string;           // "Shot Put — Heavy", "Strength — Upper"
  sessionType: "throws" | "lift" | "mixed";
  status: "planned" | "scheduled" | "in_progress" | "completed";
  scheduledTime?: string; // "9:00 AM" if available, null otherwise
  items: TimelineItem[];  // first 4 for preview, full list on detail page
  totalItemCount: number; // for "+ N more" label
  href: string;           // link to full session detail
};
```

**Normalization rules:**
- `ProgramSession.throwsPrescription` JSON → parse each implement entry → `TimelineItem` with `type: "throw"`, `detail: "${repsPerSet * sets} throws"`
- `ProgramSession.strengthPrescription` JSON → parse each exercise → `TimelineItem` with `type: "lift"`, `detail: "${sets} x ${reps}"`
- `ThrowsBlock.config` JSON → parse based on `blockType` → appropriate `TimelineItem` type
- Items sorted by `position` within each session
- Preview shows first 4 items; `totalItemCount` shown as "+ N more"

---

## API Endpoint

```
PATCH /api/athlete/dashboard-config
```

**Request body:**
```json
{
  "preset": "performance",
  "widgets": ["readiness", "today-workout", "calendar", "prs", "quick-stats"],
  "order": ["readiness", "today-workout", "calendar", "prs", "quick-stats"]
}
```

**Validation:**
- All widget IDs must be from the known catalog
- "readiness" must always be in `widgets` and first in `order`
- `order` must be a permutation of `widgets`
- `preset` is set to "custom" if widgets/order differ from any named preset

**Response:** `200 OK` with the saved config

---

## Animation Spec

| Element | Animation | Timing |
|---|---|---|
| Readiness ring fill | Spring physics, slight overshoot then settle | `spring(damping: 20, stiffness: 100)` |
| Factor bars | Staggered width grow, left-to-right | 50ms stagger, 600ms each |
| Widget entrance | Fade + slide-up on viewport entry | `<StaggeredList>` 60ms stagger |
| Tab underline | Sliding indicator follows active tab | 250ms ease-out (existing `<Tabs>`) |
| Tab content swap | Outgoing fades, incoming slides up | 150ms out, 200ms in |
| Timeline items | Staggered fade + slide-up on render/tab switch | 40ms stagger per item |
| Calendar dots | Scale 0 → 1.15 → 1.0 (spring pop) | 300ms, staggered by row |
| Start button press | Spring bounce 0.95 → 1.03 → 1.0 | 300ms (existing `<Button>`) |
| Stat numbers | Count-up on viewport entry | 1200ms (existing `<AnimatedNumber>`) |
| Customize panel | Slide-up sheet with backdrop blur | 300ms spring |
| Widget toggle | Smooth height collapse/expand | 250ms ease-out |
| PR distances | `<AnimatedNumber>` with 2 decimals | 1200ms |
| Streak badge | Subtle pulse on first render | 1 cycle, 600ms |
| Month transition | Crossfade between months | 200ms ease |

**All animations respect `prefers-reduced-motion: reduce`** — degrade to instant transitions.

**CSS transitions preferred** for all micro-interactions. Only use framer-motion for:
- Readiness ring spring fill (requires spring physics)
- Customize panel sheet animation (existing page transition pattern)

---

## Polish Details

- **Gradient backgrounds** on readiness hero shift from green-tinted to amber to red based on score, driven by CSS custom properties
- **Glass-morphism** on customize panel overlay: `backdrop-filter: blur(16px)`
- **Micro-shadows** on widgets: subtle layered shadow that deepens on hover (desktop only)
- **Shaped loading skeletons**: readiness ring = pulsing circle, calendar = grid of pulsing squares, timeline = dots + lines. Not generic rectangles.
- **Empty states**: subtle line-art icons with warm amber tones, consistent messaging
- **Haptic feedback**: "Start Workout" and customize toggles use CSS `active:scale` for mobile press feedback
- **Fonts**: Outfit (headings/numbers), DM Sans (body) — existing design system
- **Color tokens**: all from existing theme — no hardcoded hex values

---

## File Structure

```
src/app/(dashboard)/athlete/dashboard/
  page.tsx                    — main dashboard (widget orchestrator)
  _widget-registry.ts         — widget catalog, presets, fetcher map
  _customize-panel.tsx         — modal sheet for preset/toggle/reorder
  _widgets/
    readiness-hero.tsx         — ReadinessHeroWidget
    today-workout.tsx          — TodayWorkoutWidget (includes tab logic)
    workout-calendar.tsx       — WorkoutCalendarWidget
    personal-bests.tsx         — PersonalBestsWidget
    quick-stats.tsx            — QuickStatsWidget
    goals-progress.tsx         — GoalsWidget
    training-volume.tsx        — VolumeWidget (wraps existing)
    upcoming-sessions.tsx      — UpcomingSessionsWidget
    recent-videos.tsx          — VideosWidget
    pending-questionnaires.tsx — QuestionnairesWidget

src/app/api/athlete/dashboard-config/
  route.ts                    — PATCH endpoint for saving config

src/lib/data/athlete.ts       — new fetcher functions added here
```

---

## Out of Scope (Future Enhancements)

- Drag-and-drop widget reorder (upgrade from arrow buttons)
- Widget size variants (half-width, full-width on desktop)
- Coach-defined default preset per team
- Body heat map widget
- Habit tracking widget
- Real-time refresh / polling
