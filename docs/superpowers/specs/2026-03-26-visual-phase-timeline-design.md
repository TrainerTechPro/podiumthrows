# Visual Phase Timeline — Design Spec

**Date:** 2026-03-26
**Scope:** Replace the tab-per-phase layout in the self-program detail view with a compact visual timeline showing all phases as a horizontal progress bar with diamond week checkpoints.

---

## Problem Statement

The current phase view in `_program-detail.tsx` uses nested `<Tabs>` — one tab trigger per phase (ACCUMULATION, TRANSMUTATION, REALIZATION, COMPETITION). This works for 2-3 phases but becomes unwieldy at 4+. More critically, the coach/athlete cannot see the entire program arc at a glance: which phases are done, where they are now, and what's ahead. The Figma prototype showed a horizontal timeline that communicates program progression instantly.

## Goals

1. Horizontal progress bar spanning all phases, color-coded (Accumulation=blue, Transmutation=amber, Realization=green, Competition=red)
2. Diamond-shaped checkpoints per week, positioned along the bar proportionally
3. Completed weeks = filled diamond, current week = glowing/pulsing diamond, future weeks = outlined diamond
4. Click a week diamond to expand its sessions below the timeline
5. Compact overview that replaces the tab-per-phase layout but preserves all session detail
6. Phase labels above or below each segment of the bar

## Out of Scope

- Changes to the ProgramPhase or ProgramSession models
- Changes to the self-program API routes
- Program generation logic
- Coach-assigned program views (separate page)
- Drag-and-drop session reordering

## Constraints

- The existing `PHASE_COLORS` map in `_program-detail.tsx` already defines blue/amber/emerald/red for each phase — reuse these
- `ProgramPhase` has `startWeek`, `endWeek`, `durationWeeks`, `status` (PLANNED/ACTIVE/COMPLETED)
- `ProgramSession` has `weekNumber`, `dayOfWeek`, `status`, `totalThrowsTarget`, `focusLabel`
- Must remain a `"use client"` component (existing)
- The `PhaseContent` and `SessionCard` sub-components should be preserved — the timeline replaces only the tab navigation, not the session detail rendering
- Animation: use CSS transitions for diamond state changes, respect `prefers-reduced-motion`

---

## Visual Design

### Phase Timeline Bar

Full-width horizontal bar replacing the `<Tabs>` component:

```
 ACCUMULATION          TRANSMUTATION         REALIZATION      COMP
 ───────────────────── ──────────────────── ──────────────── ────
 ◆  ◆  ◆  ◆  ◆  ◆    ◇  ◇  ◇  ◇  ◇       ◇  ◇  ◇  ◇     ◇  ◇
 1  2  3  4  5  6     7  8  9  10 11      12 13 14 15    16 17
         ↑ current
```

- Phase segments: each phase occupies a proportional width based on `durationWeeks / totalWeeks`
- Segment background: phase color at 10% opacity (`bg-blue-500/10`, `bg-amber-500/10`, etc.)
- Progress fill: solid phase color fills from left up to the current week within active phase
- Phase label: `text-[10px] font-semibold uppercase tracking-wider` in the phase color, above the segment
- Phase status badge: small pill (PLANNED/ACTIVE/COMPLETED) at the right end of each segment

### Diamond Checkpoints

Each week rendered as a diamond (45-degree rotated square):

- Size: 12x12px, `transform: rotate(45deg)`
- Completed: solid fill with phase color, white checkmark inside (6px)
- Current: phase color fill with `ring-2 ring-{color}/50` glow + subtle `animate-pulse` (CSS only)
- Future: transparent fill with phase color border (1.5px), muted
- Skipped (all sessions skipped): gray fill, strikethrough pattern

Diamond positioning:
- Evenly spaced within each phase segment
- Week number below each diamond: `text-[9px] tabular-nums text-muted`
- Clickable: `cursor-pointer`, on click sets `selectedWeek` state

### Selected Week Expansion

When a diamond is clicked, the sessions for that week render below the timeline:

```
                    ▼ Week 4
┌─────────────────────────────────────────────────┐
│ Monday    THROWS_LIFT    High Vol Technical  32  │
│ Wednesday THROWS_ONLY    CE Focus           24  │
│ Friday    LIFT_ONLY      Strength Emphasis   —  │
└─────────────────────────────────────────────────┘
```

- Uses existing `SessionCard` component for each session
- Grouped under a week header: `"Week {n}"` with the phase name badge
- Smooth expand/collapse with `max-height` transition (300ms ease-out)
- Default: current week is pre-expanded on page load

### Phase Summary Pills

Below the timeline, a row of compact phase summaries:

```
[● ACCUM 6wk ✓]  [● TRANS 5wk ◐]  [● REAL 4wk ○]  [● COMP 2wk ○]
```

- Each pill: phase color dot, abbreviated name, duration, status icon (checkmark/half/circle)
- Clicking a pill scrolls the timeline to center that phase and selects its first incomplete week

### Mobile Layout

On `sm:` and below, the timeline switches to vertical:

```
● ACCUMULATION (Wk 1-6) ✓
│  ◆ Week 1
│  ◆ Week 2
│  ◆ Week 3  ← current
│  ◇ Week 4
│  ◇ Week 5
│  ◇ Week 6
│
● TRANSMUTATION (Wk 7-11)
│  ◇ Week 7
│  ...
```

- Vertical spine with diamonds on the left
- Phase headers as section dividers
- Tap a week to expand sessions inline
- Scrollable, with current week auto-scrolled into view on mount

---

## Data Flow

1. `ProgramDetail` component receives `program.phases` array (existing prop)
2. Compute `totalWeeks` by summing all `phase.durationWeeks`
3. Determine current week by comparing `program.startDate` to now
4. Map phases to timeline segments with proportional widths
5. Map weeks to diamond checkpoints, determine status from session completion
6. `selectedWeek` state (default: current week) controls which week's sessions are expanded
7. `PhaseContent` component is reused for expanded week detail, filtered to single week

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx` | Modify | Replace tab-per-phase with `PhaseTimeline` component |
| `src/app/(dashboard)/athlete/self-program/[id]/_phase-timeline.tsx` | Create | New client component for the horizontal/vertical timeline |
| `src/app/(dashboard)/athlete/self-program/[id]/_week-expansion.tsx` | Create | Week detail expansion panel using existing `SessionCard` |

## Verification Criteria

- `tsc --noEmit` passes with 0 errors
- `npm run lint` passes
- Timeline renders all phases with correct proportional widths
- Phase colors match existing `PHASE_COLORS` map (blue/amber/emerald/red)
- Diamond checkpoints show correct status (filled/glowing/outlined)
- Clicking a diamond expands that week's sessions below the timeline
- Current week is pre-expanded and its diamond glows on page load
- Mobile layout switches to vertical timeline
- All existing session detail functionality preserved (SessionCard links, status badges, throw counts)
- Expand/collapse animates smoothly (300ms)
- `prefers-reduced-motion` disables pulse animation on current week diamond
- No new dependencies introduced — pure CSS for diamonds and animations
